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
from sqlalchemy.sql import insert, update, delete, select, label, case, func
from sqlalchemy.types import Integer, String, TIMESTAMP
from sqlalchemy.dialects.postgresql import insert as pg_insert
import sqlalchemy.sql.functions as func

from .dialect import Dialect
from .listen import PGNotify

class WorkLog(object):

    DB_VERSION = 1

    STATUS_FAIL_USER = -2
    STATUS_FAIL_SYS = -1
    STATUS_UNDEFINED = 0
    STATUS_SUCCESS = 1
    
    def __init__(self, config, logger):
        self._db_path = config["uri"].replace("sqlite:///", "")
        self._client_id = config["clientID"]
        self._logger = logger
        self._current_job_id = None

        self.notifier = None
        self.conn = self.connect(config.get("uri", ""),
                        database=config.get("name", ""),
                        username=config.get("user", ""),
                        password=config.get("password", ""))
        self.lock = Lock()

        #~ if self.engine_dialect_is(Dialect.sqlite):
            # Enable foreign key constraints
            #~ self.conn.execute(text("PRAGMA foreign_keys = ON").execution_options(autocommit=True))
        #~ el
        if self.engine_dialect_is(Dialect.postgresql):
            # Create listener thread
            self.notifier = PGNotify(self.conn.engine.url)

    def connect(self, uri, database="", username="", password=""):
        uri_parts = urisplit(uri)

        if uri_parts.scheme == Dialect.sqlite:
            engine = create_engine(uri, connect_args={"check_same_thread": False})
        elif uri_parts.scheme == Dialect.postgresql:
            uri = URL(drivername=uri_parts.scheme,
                      host=uri_parts.host,
                      port=uri_parts.getport(default=5432),
                      database=database,
                      username=username,
                      password=password)
            engine = create_engine(uri)
        else:
            raise ValueError("Engine '{engine}' not supported".format(engine=uri_parts.scheme))

        return engine.connect()

    def close(self):
        self.conn.close()

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
            Column("start_time", Integer, nullable=False, server_default=text("0")),
            Column("end_time", Integer, nullable=False, server_default=text("0")),
            Column("status", Integer, nullable=False, server_default=text("0")),
            Column("tag", String(63), nullable=False, server_default=""),
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

        if self.engine_dialect_is(Dialect.postgresql):
            def should_create_function(name):
                row = self.conn.execute("select proname from pg_proc where proname = '%s'" % name).scalar()
                return not bool(row)

            def should_create_trigger(name):
                row = self.conn.execute("select tgname from pg_trigger where tgname = '%s'" % name).scalar()
                return not bool(row)

            update_lastmodified_ddl = DDL("""
                CREATE FUNCTION update_lastmodified()
                RETURNS TRIGGER AS $func$
                BEGIN
                    INSERT INTO modifications (table_name, action, changed_at)
                    VALUES(TG_TABLE_NAME, TG_OP, CURRENT_TIMESTAMP)
                    ON CONFLICT (table_name) DO UPDATE
                    SET action=TG_OP, changed_at=CURRENT_TIMESTAMP
                    WHERE modifications.table_name=TG_TABLE_NAME;
                    PERFORM pg_notify(TG_TABLE_NAME, TG_OP);
                    RETURN NULL;
                END;
                $func$ LANGUAGE plpgsql;
                """)

            if should_create_function("update_lastmodified"):
                event.listen(metadata, "after_create", update_lastmodified_ddl)

            for field in ["user", "printer"]:
                table = "{field}s".format(field=field)
                func_name = "update_{table}".format(table=table)
                func_ddl = DDL("""
                    CREATE FUNCTION {func_name}()
                    RETURNS TRIGGER AS $func$
                    BEGIN
                        IF (NOT EXISTS (SELECT FROM {table} WHERE name = NEW.{field}_name)) THEN
                            INSERT INTO {table} (name) VALUES (NEW.{field}_name);
                            PERFORM pg_notify('{table}', 'insert');
                        END IF;
                        RETURN NULL;
                    END;
                    $func$ LANGUAGE plpgsql;
                    """.format(func_name=func_name, table=table, field=field))

                if should_create_function(func_name):
                    event.listen(metadata, "after_create", func_ddl)

                for action in ["INSERT", "UPDATE"]:
                    trigger_name = "jobs_on_{action}_{table}".format(action=action.lower(), table=table)
                    trigger_ddl = DDL("""
                        CREATE TRIGGER {trigger_name} AFTER {action} on jobs
                        FOR EACH ROW
                        EXECUTE PROCEDURE {func_name}()
                        """.format(trigger_name=trigger_name, action=action, func_name=func_name))
                    if should_create_trigger(trigger_name):
                        event.listen(metadata, "after_create", trigger_ddl)

            for table in ["jobs", "users", "printers"]:
                for action in ["INSERT", "UPDATE", "DELETE"]:
                    name = "{table}_on_{action}".format(table=table, action=action.lower())
                    trigger = DDL("""
                        CREATE TRIGGER {name} AFTER {action} on {table}
                        FOR EACH ROW EXECUTE PROCEDURE update_lastmodified()
                        """.format(name=name, table=table, action=action))
                    if should_create_trigger(name):
                        event.listen(metadata, "after_create", trigger)

        elif self.engine_dialect_is(Dialect.sqlite):
            for action in ["INSERT", "UPDATE"]:
                name = "jobs_on_{action}".format(action=action.lower())
                trigger = DDL("""\
                    CREATE TRIGGER IF NOT EXISTS {name} AFTER {action} ON jobs
                    FOR EACH ROW BEGIN
                        INSERT OR IGNORE INTO users (name) VALUES (new.user_name);
                        INSERT OR IGNORE INTO printers (name) VALUES (new.printer_name);
                        DELETE FROM modifications WHERE table_name='jobs';
                        INSERT INTO modifications (table_name, action) VALUES ('jobs','{action}');
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
            
        self._logger.info("Schema version: %s" % schemaVersion)

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
        with self.lock, self.conn.begin():
            stmt = select(\
                    [self.jobs,\
                    case([(self.jobs.c.end_time < self.jobs.c.start_time, text("0"))],
                    else_=self.jobs.c.end_time - self.jobs.c.start_time).label("duration")])
            result = self.conn.execute(stmt)
        return self._result_to_dict(result)
        
    def get_job(self, identifier):
        #~ self._logger.info("get_job")
        with self.lock, self.conn.begin():
            stmt = select(\
                    [self.jobs,\
                    case([(self.jobs.c.end_time < self.jobs.c.start_time, text("0"))],
                    else_=self.jobs.c.end_time - self.jobs.c.start_time).label("duration")])\
                .where(self.jobs.c.id == identifier)
            result = self.conn.execute(stmt)
        return self._result_to_dict(result, True)

    def get_active_job(self):
        #~ self._logger.info("get_active_job")
        resultDict = None
        with self.lock, self.conn.begin():
            if not self._current_job_id is None:
                #~ self._logger.info("get_active_job: id = %s" % self._current_job_id)
                stmt = select([self.jobs]).where(self.jobs.c.id == self._current_job_id)
                result = self.conn.execute(stmt)
                resultDict = self._result_to_dict(result, True)

            if resultDict is None:
                #~ self._logger.info("get_active_job: client_id = %s" % self._client_id)
                stmt = select([self.jobs])\
                    .where((self.jobs.c.client_id == self._client_id)\
                        & (self.jobs.c.status == self.STATUS_UNDEFINED))\
                    .order_by(self.jobs.c.start_time)\
                    .limit(1)
                result = self.conn.execute(stmt)
                resultDict = self._result_to_dict(result, True)
                if not resultDict is None:
                     self._current_job_id = resultDict.get("id")
                     self._logger.info("Found stale job on client id=%s" % self._client_id)

        return resultDict

    def start_job(self, data):
        #~ self._logger.info("start_job")
        data["client_id"] = self._client_id
        with self.lock, self.conn.begin():
            stmt = insert(self.jobs)\
                .values(client_id=data["client_id"],
                    printer_name=data["printer_name"], user_name=data["user_name"],
                    file=data["file"], origin=data["origin"], file_path=data["file_path"],
                    start_time=data["start_time"])
            result = self.conn.execute(stmt)
        self._current_job_id = result.lastrowid
        data["id"] = self._current_job_id
        return data

    def update_job(self, identifier, data):
        #~ self._logger.info("update_job")
        with self.lock, self.conn.begin():
            stmt = update(self.jobs)\
                .where(self.jobs.c.id == identifier)\
                .values(user_name=data["user_name"], end_time=data["end_time"],
                        status=data["status"], notes=data["notes"])
            self.conn.execute(stmt)
        return data

    def finish_job(self, identifier, data):
        #~ self._logger.info("finish_job")
        self.update_job(identifier, data)
        if identifier == self._current_job_id:
            self._current_job_id = None
        return data

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
        with self.lock, self.conn.begin():
            stmt = select([self.users]).order_by(self.users.c.name)
            result = self.conn.execute(stmt)
        return self._result_to_dict(result)

    def get_user(self, name):
        #~ self._logger.info("get_user")
        with self.lock, self.conn.begin():
            stmt = select([self.users]).where(self.users.c.name == name)
            result = self.conn.execute(stmt)
        return self._result_to_dict(result)

    def get_all_printers(self):
        #~ self._logger.info("get_all_printers")
        with self.lock, self.conn.begin():
            stmt = select([self.printers]).order_by(self.printers.c.name)
            result = self.conn.execute(stmt)
        return self._result_to_dict(result)

    def get_printer(self, name):
        #~ self._logger.info("get_printer")
        with self.lock, self.conn.begin():
            stmt = select([self.printers]).where(self.printers.c.name == name)
            result = self.conn.execute(stmt)
        return self._result_to_dict(result)
        
    # helpers

    def _result_to_dict(self, result, one=False):
        if one:
            row = result.fetchone()
            return dict(row) if row is not None else None
        else:
            return [dict(row) for row in result.fetchall()]

    def _get_compiled_sql(self, stmt):
        try:
            return str(stmt.compile(dialect=self.conn.engine.dialect))
        except Exception as e:
            self._logger.error("Failed to compile SQL: {message}".format(message=str(e)))

        return "ERROR"
            
