/* global WorkLog ko gettext */

WorkLog.prototype.viewModels.statusFilter = function statusFilterViewModel() {
    const self = this.viewModels.statusFilter;

    self.allItems = ko.observableArray([
        { name: gettext('Printed'), value: 1 },
        { name: gettext('Failed'), value: 0 },
    ]);
    self.selected = ko.observable();

    self.test = function testDataValue(value) {
        return self.selected() === undefined || value === self.selected();
    };
};
