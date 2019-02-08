/* global WorkLog ItemListHelper ko gettext Utils OctoPrint PNotify formatDuration _ */

WorkLog.prototype.viewModels.jobs = function jobsViewModel() {
    const self = this.viewModels.jobs;
    const api = this.core.client;
    const db = this.core.common.jobStatus;

    const filesLib = this.core.bridge.allViewModels.filesViewModel;
    const connLib = this.core.bridge.allViewModels.connectionViewModel;
    const loginLib = this.core.bridge.allViewModels.loginStateViewModel;

    const fltUser = this.viewModels.userFilter;
    const fltPrinter = this.viewModels.printerFilter;
    const fltStatus = this.viewModels.statusFilter;
    const fltPeriod = this.viewModels.periodFilter;

    self.octoprintFiles = undefined;

    self.requestInProgress = ko.observable(true);

    self.totalQuantity = ko.observable(undefined);
    self.totalDuration = ko.observable(undefined);

    self.searchQuery = ko.observable(undefined);
    self.searchQuery.subscribe(() => { self.performSearch(); });

    self.currentSearchFilter = ko.observable(0);
    self.currentSearchFilter.subscribe(() => { self.performSearch(); });

    fltUser.value.subscribe(() => { self.applyFilterChange(); });
    fltPrinter.value.subscribe(() => { self.applyFilterChange(); });
    fltStatus.value.subscribe(() => { self.applyFilterChange(); });
    fltPeriod.value.subscribe(() => { self.applyFilterChange(); });

    self.activeUser = undefined;
    loginLib.currentUser.subscribe(() => {
        const user = loginLib.currentUser();
        self.activeUser = user ? user.name : undefined;
    });

    self.activePrinter = undefined;
    connLib.selectedPrinter.subscribe(() => {
        const profile = _.findWhere(connLib.printerOptions(), { id: connLib.selectedPrinter() });
        self.activePrinter = profile ? profile.name : undefined;
    });

    self.supportedSorting = {
        fileAsc(a, b) {
            return Utils.sortStrColAsc('file', a, b);
        },
        fileDesc(a, b) {
            return Utils.sortStrColDesc('file', a, b);
        },
        userAsc(a, b) {
            return Utils.sortStrColAsc('user_name', a, b);
        },
        userDesc(a, b) {
            return Utils.sortStrColDesc('user_name', a, b);
        },
        printerAsc(a, b) {
            return Utils.sortStrColAsc('printer_name', a, b);
        },
        printerDesc(a, b) {
            return Utils.sortStrColDesc('printer_name', a, b);
        },
        startAsc(a, b) {
            return Utils.sortIntColAsc('start_time', a, b);
        },
        startDesc(a, b) {
            return Utils.sortIntColDesc('start_time', a, b);
        },
        durationAsc(a, b) {
            return Utils.sortIntColAsc('duration', a, b);
        },
        durationDesc(a, b) {
            return Utils.sortIntColDesc('duration', a, b);
        },
        statusAsc(a, b) {
            return Utils.sortIntColAsc('status', a, b);
        },
        statusDesc(a, b) {
            return Utils.sortIntColDesc('status', a, b);
        },
    };

    self.supportedFilters = {
        user(data) {
            return fltUser.test(data.user_name);
        },
        printer(data) {
            return fltPrinter.test(data.printer_name);
        },
        status(data) {
            return fltStatus.test(data.status);
        },
        period(data) {
            return fltPeriod.test(data.start_time);
        },
    };

    self.supportedSearchFilters = [
        {
            name: gettext('File Name'),
            column: 'file',
        },
        {
            name: gettext('Tag'),
            column: 'tag',
        },
        {
            name: gettext('Notes'),
            column: 'notes',
        },
    ];

    self.allJobs = new ItemListHelper(
        'worklogHistory',
        self.supportedSorting,
        self.supportedFilters,
        'startAsc', [], [], 10,
    );

    self.allJobs.addFilter('user'); // add filter explicitly
    self.allJobs.addFilter('printer'); // add filter explicitly
    self.allJobs.addFilter('status'); // add filter explicitly
    self.allJobs.addFilter('period'); // add filter explicitly

    self.allJobs.items.subscribe(() => { self.updateTotals(); });

    self.updateTotals = function updateJobsTotals() {
        const items = self.allJobs.items();
        let duration = 0;
        for (let i = 0, lim = items.length; i < lim; i += 1) {
            duration += items[i].duration;
        }
        self.totalQuantity(items.length);
        self.totalDuration(formatDuration(duration));
    };

    self.jobStatusText = (status) => {
        switch (status) { // eslint-disable-line default-case
        case db.STATUS_FAIL_SYS:
        case db.STATUS_FAIL_USER:
            return gettext('Failed');
        case db.STATUS_SUCCESS:
            return gettext('Printed');
        case db.STATUS_UNDEFINED:
            return `${gettext('Printing')} ...`;
        }
        return '';
    };

    self.jobStatusClass = (status) => {
        switch (status) { // eslint-disable-line default-case
        case db.STATUS_FAIL_SYS:
        case db.STATUS_FAIL_USER:
            return 'text-error';
        case db.STATUS_SUCCESS:
        case db.STATUS_UNDEFINED:
            return 'text-success';
        }
        return '';
    };

    self.jobTag = tag => (tag ? `#${tag}` : '');

    self.jobNotes = notes => (notes ? `(${notes})` : '');

    /**
     * Clear search filter field and cancel filtering. Invoked on close button click in the filter input.
     */
    self.resetSearchFilter = () => {
        self.searchQuery(undefined);
        self.allJobs.resetSearch();
    };

    /**
     * Sort by the given column in ascending order.
     * Toggles sorting order if the journal is already sorted by that column.
     */
    self.setSorting = (column) => {
        const sortAsc = `${column}Asc`;
        if (self.allJobs.currentSorting() === sortAsc) {
            self.allJobs.changeSorting(`${column}Desc`);
        } else {
            self.allJobs.changeSorting(sortAsc);
        }
    };

    /**
     * Returns the appropriate icon to the column header depending on the given sort order.
     */
    self.sortIcon = (column) => {
        const cs = self.allJobs.currentSorting();
        if (cs.startsWith(column)) {
            return cs.endsWith('Asc') ? 'fa fa-sort-asc' : 'fa fa-sort-desc';
        }
        return '';
    };

    self.canBeEdited = item => item && item.user_name === self.activeUser;

    self.canBePrinted = (item) => {
        if (item && item.printer_name === self.activePrinter && filesLib.enablePrint() && self.octoprintFiles) {
            return _.contains(self.octoprintFiles[item.origin], item.file_path);
        }
        return false;
    };

    self.printAgain = (item) => {
        if (filesLib.listHelper.isSelectedByMatcher(data => (data && data.origin === item.origin
            && data.path === item.file_path))
            && filesLib.enablePrint(item)) {
            // file was already selected, just start the print job
            OctoPrint.job.start();
        } else {
            OctoPrint.files.select(item.origin, item.file_path, true);
        }
    };

    self.pageSize = ko.pureComputed({
        read() {
            return self.allJobs.pageSize();
        },
        write(value) {
            self.allJobs.pageSize(Utils.validInt(value, self.allJobs.pageSize()));
        },
    });

    self.performSearch = () => { // eslint-disable-line func-names
        let query = self.searchQuery();
        if (query !== undefined && query !== '') {
            query = query.toLocaleLowerCase().trim();

            const filter = self.supportedSearchFilters[self.currentSearchFilter()];

            self.allJobs.changeSearchFunction(function (entry) { // eslint-disable-line func-names, prefer-arrow-callback
                return entry[filter.column].toLocaleLowerCase().indexOf(query) > -1;
            });
        } else {
            self.allJobs.resetSearch();
        }

        return false;
    };

    self.inProgress = ko.pureComputed(function () { // eslint-disable-line func-names, prefer-arrow-callback
        return self.requestInProgress()
            || fltPrinter.requestInProgress()
            || fltUser.requestInProgress();
    });

    self.applyFilterChange = function processFilterChange() {
        self.allJobs.refresh();
        self.allJobs.currentPage(0);
    };

    self.processJobs = function processRequestedJobs(data, opts) {
        if (opts === 'notmodified') return;
        self.allJobs.updateItems(data.jobs);
    };

    self.requestJobs = function requestAllJobsFromBackend(force) {
        self.requestInProgress(true);
        return api.job.list(force, { ifModified: true })
            .done((response, opts) => { self.processJobs(response, opts); })
            .always(() => { self.requestInProgress(false); });
    };

    self.updateJob = function updateJobInBackend(item) {
        self.requestInProgress(true);
        api.job.update(item.id, item)
            .done(() => {
                self.requestJobs();
            })
            .fail(() => {
                new PNotify({ // eslint-disable-line no-new
                    title: gettext('Could not update job'),
                    text: gettext('There was an unexpected error while updating the job, please consult the logs.'),
                    type: 'error',
                    hide: false,
                });
                self.requestInProgress(false);
            });
    };

    self.updateOctoprintFiles = function updateOctoprintFilesRecursively(entry) {
        if (entry.type === 'folder') {
            _.each(entry.children, (child) => { self.updateOctoprintFiles(child); });
        } else {
            self.octoprintFiles[entry.origin].push(entry.path);
        }
    };

    self.processOctoprintFiles = function processOctoprintFilesRequest(data) {
        self.octoprintFiles = {
            local: [],
            sdcard: [],
        };
        _.each(data.files, (entry) => { self.updateOctoprintFiles(entry); });
    };

    self.requestFiles = function requestOctoprintFiles() {
        self.requestInProgress(true);
        return OctoPrint.files.list(true)
            .done((response) => { self.processOctoprintFiles(response); })
            .always(() => { self.requestInProgress(false); });
    };
};
