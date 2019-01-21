/* global WorkLog ko gettext */

WorkLog.prototype.viewModels.periodFilter = function periodFilterViewModel() {
    const self = this.viewModels.periodFilter;

    self.allItems = ko.observableArray([
        { name: gettext('Day'), value: 0 },
        { name: gettext('Week'), value: 1 },
        { name: gettext('Month'), value: 2 },
        { name: gettext('Year'), value: 3 },
    ]);
    self.selected = ko.observable();

    self.begin = -1;
    self.end = -1;

    self.changed = function periodFilterChanged() {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const d = now.getDate();

        switch (self.selected()) {
        case 0:
            self.begin = new Date(y, m, d).getTime() / 1000;
            self.end = new Date(y, m, d + 1).getTime() / 1000;
            break;
        case 1: {
            const day = now.getDay();
            const dw = d - day - (day === 0 ? 6 : -1);
            self.begin = new Date(y, m, dw).getTime() / 1000;
            self.end = new Date(y, m, dw + 8).getTime() / 1000;
        }
            break;
        case 2:
            self.begin = new Date(y, m).getTime() / 1000;
            self.end = new Date(y, m + 1, 1).getTime() / 1000;
            break;
        case 3:
            self.begin = new Date(y, 0).getTime() / 1000;
            self.end = new Date(y + 1, 0, 1).getTime() / 1000;
            break;
        default:
            self.begin = -1;
            self.end = -1;
        }

        // console.log('periodFilterChanged: ' + self.begin + ' - ' + self.end);
    };

    self.test = function testDataValue(value) {
        return self.selected() === undefined
            || (self.begin < 0 || (value >= self.begin && value < self.end));
    };
};
