# coding=utf-8
from __future__ import absolute_import

import os
import time
import datetime

import octoprint.plugin
import octoprint.printer.profile

from octoprint.settings import settings, valid_boolean_trues
from octoprint.events import Events
from octoprint.util import dict_merge
from octoprint.util.version import is_octoprint_compatible

from .api import WorkLogApi
from .data import WorkLog

class WorkLogPlugin(WorkLogApi,
                    octoprint.plugin.StartupPlugin,
                    octoprint.plugin.ShutdownPlugin,
                    octoprint.plugin.SettingsPlugin,
                    octoprint.plugin.AssetPlugin,
                    octoprint.plugin.TemplatePlugin,
                    octoprint.plugin.EventHandlerPlugin):
                        
    def __init__(self):
        self._db_path = None
        self._last_state = None
        self._timer = None
        
        self.client_id = None
        self.work_log = None
               
    def initialize(self):
        def get_client_id():
            client_id = self._settings.get(["database", "clientID"])
            if client_id is None:
                from uuid import uuid1
                client_id = str(uuid1())
                self._settings.set(["database", "clientID"], client_id)
            return client_id

        self.client_id = get_client_id()

        db_config = self._settings.get(["database"], merged=True)

        if db_config["useExternal"] not in valid_boolean_trues:
            # set uri for internal sqlite database
            db_path = os.path.join(self.get_plugin_data_folder(), "worklog.db")
            db_config["uri"] = "sqlite:///" + db_path
            db_config["clientId"] = self.client_id
        
        try:
            # initialize database
            self.work_log = WorkLog(db_config, self._logger)
            self.work_log.initialize()
            
        except Exception as e:
            self._logger.error("Failed to initialize database: {message}".format(message=str(e)))
        
    ##~~ StartupPlugin mixin
    def on_after_startup(self):
        self._logger.setLevel("DEBUG")
        printerState = self._printer.get_state_id();
        self._logger.debug("on_after_startup: " + printerState)
        if (printerState != "PRINTING" and printerState != "PAUSED"):
            data = self.work_log.get_active_job()
            if data != None:
                data["status"] = self.work_log.STATUS_FAIL
                data["notes"] = r"unexpected error"
                self.work_log.finish_job(data.get("id"), data)

    #~ ##~~ ShutdownPlugin mixin
    def on_shutdown(self):
        self._logger.debug("on_shutdown")
        data = self.work_log.get_active_job()
        if data != None:
            data["end_time"] = time.time()
            data["status"] = self.work_log.STATUS_FAIL
            data["notes"] = r"server shutdown"
            self.work_log.finish_job(data.get("id"), data)
        
    ##~~ SettingsPlugin mixin
    def get_settings_version(self):
        return 1

    def get_settings_defaults(self):
        return dict(
            database=dict(
                useExternal=False,
                uri="postgresql://",
                name="",
                user="",
                password="",
                clientID=None,
            ),
        )

    def on_settings_load(self):
        self._logger.debug("on_settings_load")
        # TODO
        data = octoprint.plugin.SettingsPlugin.on_settings_load(self)
        return data
    
    ##~~ AssetPlugin mixin
    def get_assets(self):
        return dict(
            js=["js/worklog.bundled.js"],
            css=["css/worklog.min.css"]
            #~ less=["less/worklog.less"]
        )
        
    ##~~ TemplatePlugin mixin
    def get_template_configs(self):
        return [
            dict(type="settings", custom_bindings=True)
        ]
        
    #~~ EventPlugin mixin
    def on_event(self, event, payload):
        if event == Events.PRINTER_STATE_CHANGED:
            state = payload["state_id"]
            if not (self._last_state == "PAUSED" and state == "PRINTING"):
                self._last_state = state
                #~ self._logger.debug("state: %s" % self._last_state)
            return
            
        if (event == Events.PRINT_STARTED
            or event == Events.PRINT_DONE
            or event == Events.PRINT_FAILED):
                    
            self._logger.debug("%s %s" % (event, self._last_state))
            #~ self._logger.info("%s" % payload)
            #~ self._logger.info("%s" % (settings().get(["folder", "uploads"]),))
                
            data = {
                "printer_name": self.get_current_printer(),
                "user_name": self._printer.get_current_job()["user"],
                "file": payload["name"],
                "origin": payload["origin"],
                "file_path": payload["path"]
                }

            if event == Events.PRINT_STARTED:
                self._logger.debug("PRINT_STARTED: ")
                self._logger.debug(self._printer.get_current_job())
                
                if self._last_state == "PAUSED":
                    data2 = data
                    data["end_time"] = time.time()
                    data2["status"] = self.work_log.STATUS_FAIL
                    data2["notes"] = r"restarted"
                    self.finish_current_job(data)
                    
                data["start_time"] = time.time()
                self.work_log.start_job(data)
                self.on_data_modified("jobs", "update")
                self.start_timer()
                
            else:
                data["end_time"] = time.time()
                if event == Events.PRINT_DONE:
                    self._logger.debug("PRINT_DONE: ")
                    self._logger.debug(self._printer.get_current_job())
                    data["status"] = self.work_log.STATUS_SUCCESS
                    data["notes"] = ""
                else:
                    self._logger.debug("PRINT_FAILED: ")
                    self._logger.debug(self._printer.get_current_job())
                    data["status"] = self.work_log.STATUS_FAIL
                    data["notes"] = payload["reason"]
                    
                self.finish_current_job(data)
    
    #~~ WorkLog Plugin
    def finish_current_job(self, data):
        currentJob = self.work_log.get_active_job()
        if currentJob != None:
            if data["user_name"] is None:
                data["user_name"] = currentJob["user_name"]
            self.work_log.finish_job(currentJob["id"], data)
            self.on_data_modified("jobs", "update")
            self.stop_timer()
            
        else:
            self._logger.error("Can not retrieve id for current job. ID = %s" % self.client_id())

    def update_current_job(self, data):
        currentJob = self.work_log.get_active_job()
        if currentJob == None:
            return

        full_data = dict_merge(currentJob, data)
        self.work_log.update_job(currentJob["id"], full_data)
        self.on_data_modified("jobs", "update")

    def on_data_modified(self, table, action):
        if action.lower() == "update":
            self.send_client_message("data_changed", data=dict(table=table, action=action))
    
    def send_client_message(self, message_type, data=None):
        self._plugin_manager.send_plugin_message(self._identifier, dict(type=message_type, data=data))

    def get_current_printer(self):
        current = self._printer_profile_manager.get_current()
        return current["name"] if current != None else None

    def start_timer(self):
        if self._timer is not None:
            return

        self._logger.debug("Starting timer for print time updates")
        from octoprint.util import RepeatedTimer
        self._timer = RepeatedTimer(60, self._timer_task, run_first=False)
        self._timer.start()
        
    def stop_timer(self):
        if self._timer is None:
            return
        self._timer.cancel()
        self._logger.debug("Timer stopped")

    def _timer_task(self):
        data = { "end_time": time.time() }
        self.update_current_job(data)

    #~~ Softwareupdate hook
    def get_update_information(self):
        return dict(
            worklog=dict(
                displayName="Work Log",
                displayVersion=self._plugin_version,

                # version check: github repository
                type="github_release",
                user="shvbox",
                repo="OctoPrint-WorkLog",
                current=self._plugin_version,

                # update method: pip
                pip="https://github.com/shvbox/OctoPrint-WorkLog/archive/{target_version}.zip"
            )
        )

__plugin_name__ = "Work Log"
__required_octoprint_version__ = ">=1.3.6"

def __plugin_load__():
    if not is_octoprint_compatible(__required_octoprint_version__):
        import logging
        logger = logging.getLogger(__name__)
        logger.error("OctoPrint version is not compatible ({version} required)"
                     .format(version=__required_octoprint_version__))
        return
        
    global __plugin_implementation__
    __plugin_implementation__ = WorkLogPlugin()
    
    global __plugin_hooks__
    __plugin_hooks__ = {
        "octoprint.plugin.softwareupdate.check_config": __plugin_implementation__.get_update_information,
    }
    
