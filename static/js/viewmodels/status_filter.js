/* global WorkLog ko gettext */

WorkLog.prototype.viewModels.statusFilter = function statusFilterViewModel() {
    const self = this.viewModels.statusFilter;
    const history = this.viewModels.jobs;

    self.allItems = ko.observableArray([
        { name: gettext('Printed'), value: 1 },
        { name: gettext('Failed'), value: 0 },
    ]);
    self.selected = ko.observable();
    history.allJobs.addFilter('status');

    self.changed = function statusFilterChanged() {
        history.allJobs.refresh();
        history.allJobs.currentPage(0);
    };
};
