/* global WorkLog ko gettext */

WorkLog.prototype.viewModels.periodFilter = function periodFilterViewModel() {
    const self = this.viewModels.periodFilter;

    self.allItems = ko.observableArray([
        { name: gettext('Today'), value: 0 },
        { name: gettext('Yesterday'), value: 1 },
        { name: gettext('Week'), value: 2 },
        { name: gettext('Last Week'), value: 3 },
        { name: gettext('Month'), value: 4 },
        { name: gettext('Last Month'), value: 5 },
        { name: gettext('Year'), value: 6 },
        { name: gettext('Last Year'), value: 7 },
    ]);
    self.value = ko.observable();
    self.selected = ko.observable();

    self.begin = undefined;
    self.end = undefined;

    self.changed = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const d = now.getDate();

        switch (self.selected()) {
        case 0:
            self.begin = new Date(y, m, d).getTime() / 1000;
            self.end = new Date(y, m, d + 1).getTime() / 1000;
            break;
        case 1:
            self.begin = new Date(y, m, d - 1).getTime() / 1000;
            self.end = new Date(y, m, d).getTime() / 1000;
            break;
        case 2: {
            const day = now.getDay();
            const dw = d - day - (day === 0 ? 6 : -1);
            self.begin = new Date(y, m, dw).getTime() / 1000;
            self.end = new Date(y, m, dw + 7).getTime() / 1000;
        }
            break;
        case 3: {
            const day = now.getDay();
            const dw = d - day - (day === 0 ? 6 : -1);
            self.begin = new Date(y, m, dw - 7).getTime() / 1000;
            self.end = new Date(y, m, dw).getTime() / 1000;
        }
            break;
        case 4:
            self.begin = new Date(y, m, 1).getTime() / 1000;
            self.end = new Date(y, m + 1, 1).getTime() / 1000;
            break;
        case 5:
            self.begin = new Date(y, m - 1, 1).getTime() / 1000;
            self.end = new Date(y, m, 1).getTime() / 1000;
            break;
        case 6:
            self.begin = new Date(y, 0).getTime() / 1000;
            self.end = new Date(y + 1, 0, 1).getTime() / 1000;
            break;
        case 7:
            self.begin = new Date(y - 1, 0, 1).getTime() / 1000;
            self.end = new Date(y, 0, 1).getTime() / 1000;
            break;
        default:
            self.begin = -1;
            self.end = -1;
        }

        self.value(self.selected());

        // console.log('periodFilterChanged: ' + formatDate(self.begin) + ' - ' + formatDate(self.end));
    };

    self.test = (value) => { // eslint-disable-line arrow-body-style
        return self.value() === undefined
            || self.begin === undefined
            || (value >= self.begin && value < self.end);
    };
};
