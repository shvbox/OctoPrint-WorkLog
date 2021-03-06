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
        self._last_state = None
        self._timer = None
        
        self.work_log = None
               
    def initialize(self):
        db_config = self._settings.get(["database"], merged=True)

        if db_config["useExternal"] not in valid_boolean_trues:
            # set uri for internal sqlite database
            db_path = os.path.join(self.get_plugin_data_folder(), "worklog.db")
            db_config["uri"] = "sqlite:///" + db_path
            db_config["clientID"] = self.get_client_id()
        
        try:
            # initialize database
            self.work_log = WorkLog(db_config, self._logger)
            self.work_log.initialize()
            
        except Exception as e:
            self._logger.error("Failed to initialize database: {message}".format(message=str(e)))
        
    ##~~ StartupPlugin mixin
    def on_after_startup(self):
        self._logger.setLevel("DEBUG")
        # subscribe to the notify channel so that we get notified if another client has altered the data
        # notifier is not available if we are connected to the internal sqlite database
        if self.work_log is not None and self.work_log.notifier is not None:
            def process_notification(pid, channel, payload):
                # ignore notifications triggered by our own connection
                if pid != self.work_log.conn.connection.get_backend_pid():
                    self.on_data_modified(channel, payload)
                    self._logger.debug("notify: {pid} - {ch} : {pl}".format(pid=pid, ch=channel, pl=payload))

            self.work_log.notifier.subscribe(process_notification)

        # sanitize database
        printerState = self._printer.get_state_id();
        self._logger.debug("on_after_startup: " + printerState)
        if (printerState != "PRINTING" and printerState != "PAUSED"):
            data = self.work_log.get_active_job()
            if data != None:
                data["status"] = self.work_log.STATUS_FAIL_SYS
                data["notes"] = r"unexpected error"
                self.work_log.finish_job(data.get("id"), data)

    ##~~ ShutdownPlugin mixin
    def on_shutdown(self):
        self._logger.debug("on_shutdown")
        if self.work_log is not None:
            data = self.work_log.get_active_job()
            if data != None:
                data["end_time"] = time.time()
                data["status"] = self.work_log.STATUS_FAIL_SYS
                data["notes"] = r"server shutdown"
                self.work_log.finish_job(data.get("id"), data)

            #~ if self.work_log.notifier is not None:
                #~ self.work_log.notifier.unsubscribe(self.process_notification)
                
            #~ self.work_log.close()
       
    ##~~ SettingsPlugin mixin
    def get_settings_version(self):
        return 1

    def get_settings_defaults(self):
        self._logger.debug("get_settings_defaults")
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
        
    #~ ##~~ TemplatePlugin mixin
    def get_template_configs(self):
        return [
            dict(type="tab", template="worklog_tab.jinja2"),
            dict(type="settings", template="worklog_settings.jinja2"),
            dict(type="generic", template="worklog_job_edit_dialog.jinja2"),
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
                    data2["status"] = self.work_log.STATUS_FAIL_USER
                    data2["notes"] = r"restarted"
                    self.finish_current_job(data)
                    
                data["start_time"] = time.time()
                self.work_log.start_job(data)
                self.on_data_modified("jobs", "insert")
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
                    data["status"] = self.work_log.STATUS_FAIL_USER
                    data["notes"] = payload["reason"]
                    
                self.finish_current_job(data)
    
    #~~ WorkLog Plugin
    def get_client_id(self):
        client_id = self._settings.get(["database", "clientID"])
        if client_id is None:
            from uuid import uuid4
            client_id = str(uuid4())
            self._settings.set(["database", "clientID"], client_id)
            self._settings.save()
        return client_id
    
    def finish_current_job(self, data):
        currentJob = self.work_log.get_active_job()
        if currentJob == None:
            self._logger.error("Can't retrieve id for current job. ID = %s" % self.get_client_id())
            self.stop_timer()
            return

        full_data = dict_merge(currentJob, data)
        self.work_log.finish_job(currentJob["id"], full_data)
        self.on_data_modified("jobs", "update")
        self.stop_timer()

    def update_current_job(self, data):
        currentJob = self.work_log.get_active_job()
        if currentJob == None:
            return

        full_data = dict_merge(currentJob, data)
        self.work_log.update_job(currentJob["id"], full_data)
        self.on_data_modified("jobs", "update")

    def on_data_modified(self, table, action):
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
        self._timer = RepeatedTimer(20, self.timer_task, run_first=False)
        self._timer.start()
        
    def stop_timer(self):
        if self._timer is None:
            return
        self._timer.cancel()
        self._timer = None
        self._logger.debug("Timer stopped")

    def timer_task(self):
        data = { "end_time": time.time() }
        try:
            self.update_current_job(data)
        except Exception as e:
            self._logger.error("Could not update job time: {message}".format(message=str(e)))

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
    
