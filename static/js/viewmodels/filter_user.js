/* global WorkLog ko _ gettext */

WorkLog.prototype.viewModels.userFilter = function userFilterViewModel() {
    const self = this.viewModels.userFilter;
    const api = this.core.client;

    const loginLib = this.core.bridge.allViewModels.loginStateViewModel;

    const THIS = gettext('This');

    self.activeUser = undefined;
    loginLib.currentUser.subscribe(() => {
        const user = loginLib.currentUser();
        self.activeUser = user ? user.name : undefined;
    });

    self.allItems = ko.observableArray([]);
    self.selected = ko.observable(undefined);
    self.value = ko.observable(undefined);

    self.requestInProgress = ko.observable(false);

    self.changed = () => {
        if (self.selected() === THIS) {
            self.selected(self.activeUser);
        }
        self.value(self.selected());
    };

    self.test = value => self.selected() === undefined || value === self.value();

    self.processUsers = (data) => {
        let { users } = data;
        if (users === undefined) {
            users = [];
        } else if (self.activeUser) {
            const userInList = _.find(users, entry => entry.name === self.activeUser);
            if (userInList) {
                users = [{ name: THIS }, ...users];
            }
        }
        self.allItems(users);

        self.selected(self.activeUser);
        self.changed();
    };

    self.requestUsers = (force) => {
        self.requestInProgress(true);
        return api.user.list(force)
            .done((response) => { self.processUsers(response); })
            .always(() => { self.requestInProgress(false); });
    };
};
