/* global WorkLog ko gettext */

WorkLog.prototype.viewModels.statusFilter = function statusFilterViewModel() {
    const self = this.viewModels.statusFilter;
    const db = this.core.common.jobStatus;

    self.allItems = ko.observableArray([
        { name: gettext('Printed'), value: 0 },
        { name: gettext('Failed'), value: 1 },
        { name: gettext('Good'), value: 2 },
        { name: gettext('In Print'), value: 3 },
    ]);
    self.selected = ko.observable();
    self.value = ko.observable();

    self.changed = () => { self.value(self.selected()); };

    self.test = (value) => {
        switch (self.selected()) { // eslint-disable-line default-case
        case undefined: // All
            return true;
        case 0: // Printed
            return value === db.STATUS_SUCCESS;
        case 1: // Failed
            return value < db.STATUS_UNDEFINED;
        case 2: // Good
            return value >= db.STATUS_UNDEFINED;
        case 3: // In Print
            return value === db.STATUS_UNDEFINED;
        }
        return false;
    };
};
