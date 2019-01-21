# coding=utf-8
from __future__ import absolute_import

__author__ = "Alexander Shvetsov <shv-box@mail.com>"
__license__ = "GNU Affero General Public License http://www.gnu.org/licenses/agpl.html"
__copyright__ = "Copyright (C) 2019 Alexander Shvetsov - Released under terms of the AGPLv3 License"

import os
from datetime import datetime

from flask import jsonify, request, make_response, Response
from werkzeug.exceptions import BadRequest

import octoprint.plugin
from octoprint.settings import valid_boolean_trues
#~ from octoprint.server import admin_permission
from octoprint.server.util.flask import restricted_access, check_lastmodified, check_etag
#~ from octoprint.util import dict_merge

from .util import *


class WorkLogApi(octoprint.plugin.BlueprintPlugin):

    #~ @octoprint.plugin.BlueprintPlugin.route("/totals", methods=["GET"])
    #~ def get_totals(self):
        #self._logger.info("get_job_totals")
        #~ force = request.values.get("force", "false") in valid_boolean_trues
        #~ conditions = {
            #~ "user": request.values.get("user", None),
            #~ "printer": request.values.get("printer", None),
            #~ "status": request.values.get("status", None),
            #~ "begin": request.values.get("begin", None),
            #~ "end": request.values.get("end", None),
            #~ }
#~ 
        #~ self._logger.info(u"get_totals: %s" % request.url)
        #~ 
        #~ try:
            #~ lm = self.work_log.get_jobs_lastmodified()
        #~ except Exception as e:
            #~ lm = None
            #~ self._logger.error("Failed to fetch jobs lastmodified timestamp: {message}".format(message=str(e)))
#~ 
        #~ etag = entity_tag(lm)
#~ 
        #~ if not force and check_lastmodified(lm) and check_etag(etag):
            #~ return make_response("Not Modified", 304)
#~ 
        #~ try:
            #~ self._logger.info(u"get_totals: %s" % conditions)
            #~ totals = self.work_log.get_job_totals(conditions)
            #~ response = jsonify(dict(totals=totals))
            #~ return add_revalidation_header_with_no_max_age(response, lm, etag)
        #~ except Exception as e:
            #~ self._logger.error("Failed to fetch totals: {message}".format(message=str(e)))
            #~ return make_response("Failed to fetch totals, see the log for more details", 500)

    @octoprint.plugin.BlueprintPlugin.route("/jobs", methods=["GET"])
    def get_job_list(self):
        #~ self._logger.info("get_job_list")
        force = request.values.get("force", "false") in valid_boolean_trues

        try:
            lm = self.work_log.get_jobs_lastmodified()
        except Exception as e:
            lm = None
            self._logger.error("Failed to fetch jobs lastmodified timestamp: {message}".format(message=str(e)))

        etag = entity_tag(lm)

        if not force and check_lastmodified(lm) and check_etag(etag):
            return make_response("Not Modified", 304)

        try:
            all_jobs = self.work_log.get_all_jobs()
            response = jsonify(dict(jobs=all_jobs))
            #~ self._logger.info("get_job_list: %s", (all_jobs))
            return add_revalidation_header_with_no_max_age(response, lm, etag)
        except Exception as e:
            self._logger.error("Failed to fetch jobs: {message}".format(message=str(e)))
            return make_response("Failed to fetch jobs, see the log for more details", 500)

    @octoprint.plugin.BlueprintPlugin.route("/jobs/<int:identifier>", methods=["GET"])
    def get_job(self, identifier):
        #~ self._logger.info("get_job")
        try:
            job = self.work_log.get_job(identifier)
            if job is not None:
                return jsonify(dict(job=job))
            else:
                self._logger.warn("Job with id {id} does not exist".format(id=identifier))
                return make_response("Unknown job", 404)
        except Exception as e:
            self._logger.error("Failed to fetch job with id {id}: {message}"
                               .format(id=str(identifier), message=str(e)))
            return make_response("Failed to fetch job, see the log for more details", 500)

    #~ @octoprint.plugin.BlueprintPlugin.route("/jobs", methods=["POST"])
    #~ @restricted_access
    #~ def start_job(self):
        #~ if "application/json" not in request.headers["Content-Type"]:
            #~ return make_response("Expected content-type JSON", 400)
#~ 
        #~ try:
            #~ json_data = request.json
        #~ except BadRequest:
            #~ return make_response("Malformed JSON body in request", 400)
#~ 
        #~ if "job" not in json_data:
            #~ return make_response("No job included in request", 400)
#~ 
        #~ new_job = json_data["job"]
#~ 
        #~ for key in ["printer", "user", "file", "start"]:
            #~ if key not in new_job:
                #~ return make_response("Job does not contain mandatory '{}' field".format(key), 400)
#~ 
        #~ try:
            #~ saved_job = self.work_log.start_job(new_job)
            #~ return jsonify(dict(job=saved_job))
        #~ except Exception as e:
            #~ self._logger.error("Failed to create job: {message}".format(message=str(e)))
            #~ return make_response("Failed to create job, see the log for more details", 500)

    @octoprint.plugin.BlueprintPlugin.route("/users", methods=["GET"])
    def get_user_list(self):
        #~ self._logger.info("get_user_list")
        force = request.values.get("force", "false") in valid_boolean_trues

        try:
            lm = self.work_log.get_users_lastmodified()
        except Exception as e:
            lm = None
            self._logger.error("Failed to fetch lastmodified timestamp: {message}".format(message=str(e)))

        etag = entity_tag(lm)

        if not force and check_lastmodified(lm) and check_etag(etag):
            return make_response("Not Modified", 304)

        try:
            all_users = self.work_log.get_all_users()
            response = jsonify(dict(users=all_users))
            #~ self._logger.info("get_user_list: %s", (all_users))
            return add_revalidation_header_with_no_max_age(response, lm, etag)
        except Exception as e:
            self._logger.error("Failed to fetch users: {message}".format(message=str(e)))
            return make_response("Failed to fetch users, see the log for more details", 500)

    @octoprint.plugin.BlueprintPlugin.route("/users/<name>", methods=["GET"])
    def get_user(self, name):
        #~ self._logger.info("get_user")
        try:
            user = self.work_log.get_user(name)
            if user is not None:
                return jsonify(dict(user=user))
            else:
                self._logger.warn("User with name {name} does not exist")
                return make_response("Unknown job", 404)
        except Exception as e:
            self._logger.error("Failed to fetch user with id {id}: {message}"
                               .format(id=str(name), message=str(e)))
            return make_response("Failed to fetch user, see the log for more details", 500)

    @octoprint.plugin.BlueprintPlugin.route("/printers", methods=["GET"])
    def get_printer_list(self):
        #~ self._logger.info("get_printer_list")
        force = request.values.get("force", "false") in valid_boolean_trues

        try:
            lm = self.work_log.get_printers_lastmodified()
        except Exception as e:
            lm = None
            self._logger.error("Failed to fetch lastmodified timestamp: {message}".format(message=str(e)))

        etag = entity_tag(lm)

        if not force and check_lastmodified(lm) and check_etag(etag):
            return make_response("Not Modified", 304)

        try:
            all_printers = self.work_log.get_all_printers()
            response = jsonify(dict(printers=all_printers))
            #~ self._logger.info("get_printer_list: %s", (all_printers))
            return add_revalidation_header_with_no_max_age(response, lm, etag)
        except Exception as e:
            self._logger.error("Failed to fetch printers: {message}".format(message=str(e)))
            return make_response("Failed to fetch printers, see the log for more details", 500)

    @octoprint.plugin.BlueprintPlugin.route("/printers/<name>", methods=["GET"])
    def get_printer(self, name):
        #~ self._logger.info("get_printer")
        try:
            printer = self.work_log.get_printer(name)
            if printer is not None:
                return jsonify(dict(printer=printer))
            else:
                self._logger.warn("Printer with name {name} does not exist")
                return make_response("Unknown job", 404)
        except Exception as e:
            self._logger.error("Failed to fetch printer with id {id}: {message}"
                               .format(id=str(name), message=str(e)))
            return make_response("Failed to fetch printer, see the log for more details", 500)

    #~ @octoprint.plugin.BlueprintPlugin.route("/database/test", methods=["POST"])
    #~ @restricted_access
    #~ def test_database_connection(self):
        #~ if "application/json" not in request.headers["Content-Type"]:
            #~ return make_response("Expected content-type JSON", 400)
#~ 
        #~ try:
            #~ json_data = request.json
        #~ except BadRequest:
            #~ return make_response("Malformed JSON body in request", 400)
#~ 
        #~ if "config" not in json_data:
            #~ return make_response("No database configuration included in request", 400)
#~ 
        #~ config = json_data["config"]
#~ 
        #~ for key in ["uri", "name", "user", "password"]:
            #~ if key not in config:
                #~ return make_response("Configuration does not contain mandatory '{}' field".format(key), 400)
#~ 
        #~ try:
            #~ connection = self.filamentManager.connect(config["uri"],
                                                      #~ database=config["name"],
                                                      #~ username=config["user"],
                                                      #~ password=config["password"])
        #~ except Exception as e:
            #~ return make_response("Failed to connect to the database with the given configuration", 400)
        #~ else:
            #~ connection.close()
            #~ return make_response("", 204)
