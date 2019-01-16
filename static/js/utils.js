class Utils { // eslint-disable-line no-unused-vars
    static validInt(value, def) {
        const v = Number.parseInt(value, 10);
        return Number.isNaN(v) ? def : v;
    }

    static validFloat(value, def) {
        const v = Number.parseFloat(value);
        return Number.isNaN(v) ? def : v;
    }

    static runRequestChain(requests) {
        let index = 0;

        const next = function callNextRequest() {
            if (index < requests.length) {
                // Do the next, increment the call index
                requests[index]().done(() => {
                    index += 1;
                    next();
                });
            }
        };

        next(); // Start chain
    }

    static extractToolIDFromName(name) {
        const result = /(\d+)/.exec(name);
        return result === null ? 0 : result[1];
    }

    static sortStrColAsc(column, a, b) {
        if (a[column].toLocaleLowerCase() < b[column].toLocaleLowerCase()) return -1;
        if (a[column].toLocaleLowerCase() > b[column].toLocaleLowerCase()) return 1;
        return 0;
    }

    static sortStrColDesc(column, a, b) {
        if (a[column].toLocaleLowerCase() < b[column].toLocaleLowerCase()) return 1;
        if (a[column].toLocaleLowerCase() > b[column].toLocaleLowerCase()) return -1;
        return 0;
    }

    static sortIntColAsc(column, a, b) {
        const ta = parseInt(a[column]);
        const tb = parseInt(b[column]);
        if (ta < tb) return 1;
        if (ta > tb) return -1;
        return 0;
    }

    static sortIntColDesc(column, a, b) {
        const ta = parseInt(a[column]);
        const tb = parseInt(b[column]);
        if (ta < tb) return -1;
        if (ta > tb) return 1;
        return 0;
    }


    static printJSON(data, indent = '') {
        for (var key in data) {
            const val = data[key];
            if (typeof val === 'object') {
                console.log(indent + 'key: ' + key + ', value: ');
                Utils.printJSON(val, indent + '  ');
            } else {
                console.log(indent + 'key: ' + key + ', value: ' + val);
            }
        }
    }
}
