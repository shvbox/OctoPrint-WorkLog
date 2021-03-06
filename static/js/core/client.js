/* global WorkLog OctoPrint */

WorkLog.prototype.core.client = function apiClient() {
    const self = this.core.client;

    const pluginUrl = 'plugin/worklog';

    const jobUrl = function apiJobNamespace(id) {
        const url = `${pluginUrl}/jobs`;
        return (id === undefined) ? url : `${url}/${id}`;
    };

    const userUrl = function apiUserNamespace(name) {
        const url = `${pluginUrl}/users`;
        return (name === undefined) ? url : `${url}/${name}`;
    };

    const printerUrl = function apiPrinterNamespace(name) {
        const url = `${pluginUrl}/printers`;
        return (name === undefined) ? url : `${url}/${name}`;
    };

    //~ const totalsUrl = function apiTotalsNamespace() {
        //~ return `${pluginUrl}/totals`;
    //~ };

    self.job = {
        list(force = false, opts) {
            const query = force ? { force } : {};
            return OctoPrint.getWithQuery(jobUrl(), query, opts);
        },

        get(id, opts) {
            return OctoPrint.get(jobUrl(id), opts);
        },

        //~ add(job, opts) {
            //~ const data = { job };
            //~ return OctoPrint.postJson(jobUrl(), data, opts);
        //~ },

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

    //~ self.totals = {
        //~ get(force = false, filters = undefined, opts) {
            //~ const query = force ? { force } : {};
            //~ if (filters) {
                //~ const { user, printer, status, begin, end } = filters; // eslint-disable-line object-curly-newline
                //~ if (user) { query.user = user; }
                //~ if (printer) { query.printer = printer; }
                //~ if (status !== undefined) { query.status = status; }
                //~ if (begin > 0) { query.begin = begin; }
                //~ if (end > 0) { query.end = end; }
            //~ }
            //~ return OctoPrint.getWithQuery(totalsUrl(), query, opts);
        //~ },
    //~ };

    self.database = {
        test(config, opts) {
            const url = `${pluginUrl}/database/test`;
            const data = { config };
            return OctoPrint.postJson(url, data, opts);
        },
    };
};
