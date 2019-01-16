/* global WorkLog OctoPrint */

WorkLog.prototype.core.client = function apiClient() {
    const self = this.core.client;

    const pluginUrl = 'plugin/worklog';

    const jobUrl = function apiJobNamespace(job) {
        const url = `${pluginUrl}/jobs`;
        return (job === undefined) ? url : `${url}/${job}`;
    };

    const userUrl = function apiUserNamespace(user) {
        const url = `${pluginUrl}/users`;
        return (user === undefined) ? url : `${url}/${user}`;
    };

    const printerUrl = function apiPrinterNamespace(printer) {
        const url = `${pluginUrl}/printers`;
        return (printer === undefined) ? url : `${url}/${printer}`;
    };

    self.job = {
        list(force = false, opts) {
            const query = force ? { force } : {};
            return OctoPrint.getWithQuery(jobUrl(), query, opts);
        },

        get(id, opts) {
            return OctoPrint.get(jobUrl(id), opts);
        },

        add(job, opts) {
            const data = { job };
            return OctoPrint.postJson(jobUrl(), data, opts);
        },

        update(id, job, opts) {
            const data = { job };
            return OctoPrint.patchJson(jobUrl(id), data, opts);
        },

        delete(id, opts) {
            return OctoPrint.delete(jobUrl(id), opts);
        },
    };

    self.user = {
        list(force = false, opts) {
            const query = force ? { force } : {};
            return OctoPrint.getWithQuery(userUrl(), query, opts);
        },

        get(id, opts) {
            return OctoPrint.get(userUrl(id), opts);
        },
    };

    self.printer = {
        list(force = false, opts) {
            const query = force ? { force } : {};
            return OctoPrint.getWithQuery(printerUrl(), query, opts);
        },

        get(id, opts) {
            return OctoPrint.get(printerUrl(id), opts);
        },
    };

    self.database = {
        test(config, opts) {
            const url = `${pluginUrl}/database/test`;
            const data = { config };
            return OctoPrint.postJson(url, data, opts);
        },
    };
};
