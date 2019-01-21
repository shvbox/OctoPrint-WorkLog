/* global WorkLog ko */

WorkLog.prototype.viewModels.userFilter = function userFilterViewModel() {
    const self = this.viewModels.userFilter;
    const api = this.core.client;

    const loginLib = this.core.bridge.allViewModels.loginStateViewModel;

    self.allItems = ko.observableArray([]);
    self.selected = ko.observable(undefined);
    self.requestInProgress = ko.observable(false);

    self.userChanged = false;
    loginLib.currentUser.subscribe(() => { self.userChanged = true; });

    self.test = function testDataValue(value) {
        return self.selected() === undefined || value === self.selected();
    };

    self.processUsers = function processRequestedUsers(data) {
        let { users } = data;
        if (users === undefined) users = [];
        self.allItems(users);

        if (self.userChanged) {
            const user = loginLib.currentUser();
            self.selected(user ? user.name : undefined);
            self.userChanged = false;
        }
    };

    self.requestUsers = function requestAllUsersFromBackend(force) {
        self.requestInProgress(true);
        return api.user.list(force)
            .done((response) => { self.processUsers(response); })
            .always(() => { self.requestInProgress(false); });
    };
};
