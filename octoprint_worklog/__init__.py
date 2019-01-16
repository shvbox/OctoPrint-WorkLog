# coding=utf-8
from __future__ import absolute_import

import octoprint.plugin
import os
import time
import octoprint.printer.profile

from octoprint.settings import settings
from octoprint.events import Events
from flask_login import current_user

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
        self._user = None
        self._last_state = None
        
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

        self._db_path = os.path.join(self.get_plugin_data_folder(), "worklog.db")
        db_config = {
            "path": os.path.join(self.get_plugin_data_folder(), "worklog.db"),
            "clientId": self.client_id,
            "logger": self._logger
            }
        
        try:
            # initialize database
            self.work_log = WorkLog(db_config)
            self.work_log.initialize()
            
        except Exception as e:
            self._logger.error("Failed to initialize database: {message}".format(message=str(e)))
        
    ##~~ StartupPlugin mixin
    def on_after_startup(self):
        printerState = self._printer.get_state_id();
        self._logger.info("on_after_startup: " + printerState)
        if (printerState != "PRINTING" and printerState != "PAUSED"):
            data = self.work_log.get_active_job(self.get_current_printer())
            if data != None:
                data["end"] = -1
                data["status"] = self.work_log.STATUS_FAIL
                data["notes"] = r"unexpected server shutdown"
                self.work_log.finish_job(data.get("id"), data)

    #~ ##~~ ShutdownPlugin mixin
    def on_shutdown(self):
        self._logger.info("on_shutdown")
        data = self.work_log.get_active_job(self.get_current_printer())
        if data != None:
            data["end"] = time.time()
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
        self._logger.info("on_settings_load")
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
                #~ self._logger.info("state: %s" % self._last_state)
            return
            
        if (event == Events.PRINT_STARTED
            or event == Events.PRINT_DONE
            or event == Events.PRINT_FAILED):
                    
            self._logger.info("%s %s %s" % (event, self._user, self._last_state))
            #~ self._logger.info("%s" % payload)
            #~ self._logger.info("%s" % (settings().get(["folder", "uploads"]),))
                
            data = {
                "client_id": self.client_id,
                "printer": self.get_current_printer(),
                "user": self._printer.get_current_job()["user"],
                "file": payload["name"],
                "origin": payload["origin"],
                "path": payload["path"]
                }

            if event == Events.PRINT_STARTED:
                self._logger.info("PRINT_STARTED: ")
                self._logger.info(self._printer.get_current_job())
                
                if self._last_state == "PAUSED":
                    data2 = data
                    data["end"] = time.time()
                    data2["status"] = self.work_log.STATUS_FAIL
                    data2["notes"] = r"restarted"
                    self.update_current_job(data)
                    
                data["start"] = time.time()
                self.work_log.start_job(data)
                self.send_client_message("data_changed", data=dict(table="jobs", action="update"))

            else:
                data["end"] = time.time()
                if event == Events.PRINT_DONE:
                    self._logger.info("PRINT_DONE: ")
                    self._logger.info(self._printer.get_current_job())
                    data["status"] = self.work_log.STATUS_SUCCESS
                    data["notes"] = ""
                else:
                    self._logger.info("PRINT_FAILED: ")
                    self._logger.info(self._printer.get_current_job())
                    data["status"] = self.work_log.STATUS_FAIL
                    data["notes"] = payload["reason"]
                    
                self.update_current_job(data)
    
    #~~ WorkLog Plugin
    def update_current_job(self, data):
        currentJob = self.work_log.get_active_job(self.get_current_printer())
        if currentJob != None:
            self.work_log.finish_job(currentJob.get("id"), data)
            self.send_client_message("data_changed", data=dict(table="jobs", action="update"))
            
        else:
            self._logger.error("Can not retrieve id for current job")
    
    def send_client_message(self, message_type, data=None):
        self._plugin_manager.send_plugin_message(self._identifier, dict(type=message_type, data=data))

    def get_current_printer(self):
        current = self._printer_profile_manager.get_current()
        return current["name"] if current != None else None
        
__plugin_name__ = "Work Log"
__plugin_implementation__ = WorkLogPlugin()
