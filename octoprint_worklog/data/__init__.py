# coding=utf-8
from __future__ import absolute_import

__author__ = "Alexander Shvetsov <shv-box@mail.com>"
__license__ = "GNU Affero General Public License http://www.gnu.org/licenses/agpl.html"
__copyright__ = "Copyright (C) 2019 Alexander Shvetsov - Released under terms of the AGPLv3 License"

import os
import sqlite3

from multiprocessing import Lock
from uritools import urisplit
from sqlalchemy.engine.url import URL
from sqlalchemy import create_engine, event, text
from sqlalchemy.schema import MetaData, Table, Column, DDL, PrimaryKeyConstraint
from sqlalchemy.sql import insert, update, delete, select, label
from sqlalchemy.types import Integer, String, TIMESTAMP
from sqlalchemy.dialects.postgresql import insert as pg_insert
import sqlalchemy.sql.functions as func

#~ from .listen import PGNotify

class WorkLog(object):

    DB_VERSION = 1

    DIALECT_SQLITE = "sqlite"
    DIALECT_POSTGRESQL = "postgresql"
    
    STATUS_UNDEFINED = -1
    STATUS_FAIL = 0
    STATUS_SUCCESS = 1
    
    def __init__(self, config, logger):
        self._db_path = config["uri"].replace("sqlite:///", "")
        self._client_id = config["clientId"]
        self._logger = logger
        self._current_job_id = None

        self.notify = None
        self.conn = self.connect(config.get("uri", ""),
                        database=config.get("name", ""),
                        username=config.get("user", ""),
                        password=config.get("password", ""))
        self.lock = Lock()

        #~ if self.engine_dialect_is(self.DIALECT_SQLITE):
            # Enable foreign key constraints
            #~ self.conn.execute(text("PRAGMA foreign_keys = ON").execution_options(autocommit=True))
        #~ elif self.engine_dialect_is(self.DIALECT_POSTGRESQL):
            # Create listener thread
            #~ self.notify = PGNotify(self.conn.engine.url)


    def connect(self, uri, database="", username="", password=""):
        uri_parts = urisplit(uri)

        if uri_parts.scheme == self.DIALECT_SQLITE:
            engine = create_engine(uri, connect_args={"check_same_thread": False})
        #~ elif uri_parts.scheme == self.DIALECT_POSTGRESQL:
            #~ uri = URL(drivername=uri_parts.scheme,
                      #~ host=uri_parts.host,
                      #~ port=uri_parts.getport(default=5432),
                      #~ database=database,
                      #~ username=username,
                      #~ password=password)
            #~ engine = create_engine(uri)
        else:
            raise ValueError("Engine '{engine}' not supported".format(engine=uri_parts.scheme))

        return engine.connect()
 
    def engine_dialect_is(self, dialect):
        return self.conn.engine.dialect.name == dialect if self.conn is not None else False

    def initialize(self):
        metadata = MetaData()

        self.jobs = Table("jobs", metadata,
            Column("id", Integer, primary_key=True, autoincrement=True),
            Column("client_id", String(36), nullable=False, index=True),
            Column("printer_name", String(255), index=True),
            Column("user_name", String(255), index=True),
            Column("file", String(255), index=True),
            Column("origin", String(15), nullable=False, index=True),
            Column("file_path", String(255), nullable=False),
            Column("start_time", Integer, nullable=False, server_default=text("-1")),
            Column("end_time", Integer, nullable=False, server_default=text("-1")),
            Column("status", Integer, nullable=False, server_default=text("-1")),
            Column("notes", String(255), nullable=False, server_default=""))

        self.modifications = Table("modifications", metadata,
            Column("table_name", String(255), primary_key=True),
            Column("action", String(255), nullable=False),
            Column("changed_at", TIMESTAMP, nullable=False, server_default=text("CURRENT_TIMESTAMP")))

        self.users = Table("users", metadata,
            Column("name", String(255), primary_key=True))

        self.printers = Table("printers", metadata,
            Column("name", String(255), primary_key=True))

        self.version = Table("version", metadata,
            Column("id", Integer, primary_key=True, autoincrement=False))

        if self.engine_dialect_is(self.DIALECT_SQLITE):
            for action in ["INSERT", "UPDATE"]:
                name = "jobs_on_{action}".format(action=action.lower())
                trigger = DDL("""\
                    CREATE TRIGGER IF NOT EXISTS {name} AFTER {action} ON jobs
                    FOR EACH ROW BEGIN
                        INSERT OR IGNORE INTO users (name) VALUES (new.user_name);
                        INSERT OR IGNORE INTO printers (name) VALUES (new.printer_name);
                        INSERT OR REPLACE INTO modifications (table_name, action) VALUES ('jobs','{action}');
                    END;
                    """.format(name=name, action=action))
                event.listen(metadata, "after_create", trigger)

            trigger = DDL("""\
                CREATE TRIGGER IF NOT EXISTS jobs_on_delete AFTER DELETE ON jobs
                FOR EACH ROW BEGIN
                    INSERT OR REPLACE INTO modifications (table_name, action) VALUES ('jobs','DELETE');
                END;
                """)
            event.listen(metadata, "after_create", trigger)

            for table in ["users", "printers"]:
                for action in ["INSERT", "UPDATE", "DELETE"]:
                    name = "{table}_on_{action}".format(table=table, action=action.lower())
                    trigger = DDL("""\
                        CREATE TRIGGER IF NOT EXISTS {name} AFTER {action} ON {table}
                        FOR EACH ROW BEGIN
                            DELETE FROM modifications WHERE table_name='{table}';
                            INSERT INTO modifications (table_name, action) VALUES ('{table}','{action}');
                        END;
                        """.format(name=name, table=table, action=action))
                    event.listen(metadata, "after_create", trigger)

        metadata.create_all(self.conn, checkfirst=True)

        # Check database version
        schemaVersion = self.get_schema_version()
        
        if schemaVersion is None:
            self.set_schema_version(self.DB_VERSION)
            schemaVersion = self.DB_VERSION
            
        self._logger.info("schema version: %s" % schemaVersion)

    # versioning

    def get_schema_version(self):
        with self.lock, self.conn.begin():
            return self.conn.execute(select([func.max(self.version.c.id)])).scalar()

    def set_schema_version(self, version):
        with self.lock, self.conn.begin():
            self.conn.execute(insert(self.version).values((version,)))
            self.conn.execute(delete(self.version).where(self.version.c.id < version))

    # modifications

    def get_lastmodified(self):
        with self.lock, self.conn.begin():
            stmt = select([func.max(self.modifications.c.changed_at)])
            return self.conn.execute(stmt).scalar()

    def get_table_lastmodified(self, table):
        with self.lock, self.conn.begin():
            stmt = select([self.modifications.c.changed_at]).where(self.modifications.c.table_name == table)
            return self.conn.execute(stmt).scalar()
        
    def get_jobs_lastmodified(self):
        return self.get_table_lastmodified("jobs")
        
    def get_users_lastmodified(self):
        return self.get_table_lastmodified("users")
        
    def get_printers_lastmodified(self):
        return self.get_table_lastmodified("printers")
        
    # jobs

    def get_all_jobs(self):
        #~ self._logger.info("get_all_jobs")
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        cur  = conn.cursor()
        cur.execute("SELECT *, CASE WHEN (end_time < start_time) THEN 0 ELSE (end_time - start_time) END AS duration FROM jobs")
        result = self._result_to_dict(cur)
        conn.close()
        return result
        #~ with self.lock, self.conn.begin():
            #~ stmt = select([self.jobs]).order_by(self.jobs.c.material, self.jobs.c.vendor)
            #~ result = self.conn.execute(stmt)
        #~ return self._result_to_dict(result)
        
    def get_job(self, identifier):
        #~ self._logger.info("get_job")
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        cur  = conn.cursor()
        cur.execute("SELECT *,  CASE WHEN (end_time < start_time) THEN 0 ELSE (end_time - start_time) END AS duration FROM jobs WHERE id=?", (identifier,))
        result = self._result_to_dict(cur)
        conn.close()
        return result
        #~ with self.lock, self.conn.begin():
            #~ stmt = select([self.jobs]).where(self.jobs.c.id == identifier)\
                #~ .order_by(self.jobs.c.material, self.jobs.c.vendor)
            #~ result = self.conn.execute(stmt)
        #~ return self._result_to_dict(result, one=True)

    
    def get_active_job(self):
        #~ self._logger.info("get_active_job")
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        cur  = conn.cursor()

        result = None
        if not self._current_job_id is None:
            self._logger.info("get_active_job: id = %s" % self._current_job_id)
            cur.execute("SELECT * FROM jobs WHERE id=?", (self._current_job_id,))
            result = self._result_to_dict(cur, True)

        if result is None:
            self._logger.info("get_active_job: client_id = %s" % self._client_id)
            cur.execute("SELECT * FROM jobs WHERE client_id=? AND status=? ORDER BY start_time LIMIT 1", (self._client_id, self.STATUS_UNDEFINED))
            result = self._result_to_dict(cur, True)
            if not result is None:
                 self._current_job_id = result.get("id")
                 self._logger.info("get_active_job: found stale job on client id=%s" % self._client_id)
            
        conn.close()
        return result

    def start_job(self, data):
        #~ self._logger.info("start_job")
        data["client_id"] = self._client_id
        sql = """\
        INSERT INTO jobs (client_id, printer_name, user_name, file, origin, file_path, start_time) 
        VALUES (:client_id, :printer_name, :user_name, :file, :origin, :file_path, :start_time)
        """
        conn = sqlite3.connect(self._db_path)
        cur = conn.cursor()
        cur.execute(sql, data)
        conn.commit()
        self._current_job_id = cur.lastrowid
        data["id"] = self._current_job_id
        conn.close()
        return data
        #~ with self.lock, self.conn.begin():
            #~ stmt = insert(self.jobs)\
                #~ .values(vendor=data["printer"], material=data["user"], density=data["file"],
                        #~ diameter=data["start"])
            #~ result = self.conn.execute(stmt)
        #~ data["id"] = result.lastrowid
        #~ return data

    def finish_job(self, identifier, data):
        #~ self._logger.info("finish_job")
        data["id"] = identifier
        sql = """\
        UPDATE jobs 
        SET user_name=:user_name, end_time=:end_time, status=:status, notes=:notes 
        WHERE id=:id
        ORDER BY id DESC 
        LIMIT 1
        """
        conn = sqlite3.connect(self._db_path)
        cur = conn.cursor()
        cur.execute(sql, data)
        conn.commit()
        conn.close()
        self._current_job_id = None
        return data
         #~ with self.lock, self.conn.begin():
            #~ stmt = update(self.jobs).where(self.jobs.c.id == identifier)\
                #~ .values(vendor=data["vendor"], material=data["material"], density=data["density"],
                        #~ diameter=data["diameter"])
            #~ self.conn.execute(stmt)
        #~ return data

    #~ def get_job_totals(self, conditions):
        #~ sql = """\
        #~ SELECT 
            #~ COUNT(id) AS total_quantity,
            #~ SUM(CASE WHEN (end_time < start_time) THEN 0 ELSE end_time - start_time END) AS total_duration
        #~ FROM v_jobs
        #~ WHERE (CASE WHEN :user IS NULL THEN 1 ELSE user_name=:user END)
            #~ AND (CASE WHEN :printer IS NULL THEN 1 ELSE printer_name=:printer END)
            #~ AND (CASE WHEN :status IS NULL THEN 1 ELSE status=:status END)
            #~ AND (CASE WHEN :begin IS NULL THEN 1 ELSE start_time>=:begin END)
            #~ AND (CASE WHEN :end IS NULL THEN 1 ELSE start_time<:end END)
        #~ """
        #~ conn = sqlite3.connect(self._db_path)
        #~ conn.row_factory = sqlite3.Row
        #~ cur = conn.cursor()
        #~ cur.execute(sql, conditions)
        #~ result = self._result_to_dict(cur, True)
        #~ conn.close()
        #~ return result
        
    def get_all_users(self):
        #~ self._logger.info("get_all_users")
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        cur  = conn.cursor()
        cur.execute("SELECT * FROM users ORDER BY name")
        result = self._result_to_dict(cur)
        conn.close()
        #~ self._logger.info("get_all_users: %s", (result,))
        return result

    def get_user(self, name):
        #~ self._logger.info("get_user")
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        cur  = conn.cursor()
        cur.execute("SELECT * FROM users WHERE name=?", (name,))
        result = self._result_to_dict(cur, True)
        conn.close()
        #~ self._logger.info("get_all_users: %s", (result,))
        return result
        
    def get_all_printers(self):
        #~ self._logger.info("get_all_printers")
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        cur  = conn.cursor()
        cur.execute("SELECT * FROM printers ORDER BY name")
        result = self._result_to_dict(cur)
        conn.close()
        #~ self._logger.info("get_all_printers: %s", (result,))
        return result

    def get_printer(self, name):
        #~ self._logger.info("get_printer")
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        cur  = conn.cursor()
        result = None
        cur.execute("SELECT * FROM printers WHERE name=?", (name,))
        result = self._result_to_dict(cur, True)
        conn.close()
        #~ self._logger.info("get_all_printers: %s", (result,))
        return result
        
    # helper

    def _result_to_dict(self, result, one=False):
        if one:
            row = result.fetchone()
            return dict(row) if row is not None else None
        else:
            return [dict(row) for row in result.fetchall()]

