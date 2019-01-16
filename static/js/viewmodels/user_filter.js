/* global WorkLog ko */

WorkLog.prototype.viewModels.userFilter = function userFilterViewModel() {
    const self = this.viewModels.userFilter;
    const api = this.core.client;
    const history = this.viewModels.jobs;

    self.allItems = ko.observableArray([]);
    self.selected = ko.observable();
    self.requestInProgress = ko.observable(false);

    history.allJobs.addFilter('user');

    self.changed = function userFilterChanged() {
        history.allJobs.refresh();
        history.allJobs.currentPage(0);
    };

    self.processUsers = function processRequestedUsers(data) {
        let { users } = data;
        if (users === undefined) users = [];
        self.allItems(users);
    };

    self.processActiveUser = function processRequestedActiveUser(data) {
        const { user } = data;
        if (user !== undefined) {
            self.selected(user.name);
        }
    };

    self.requestActiveUser = function requestActiveUserFromBackend() {
        self.requestInProgress(true);
        return api.user.get('@')
            .done((response) => { self.processActiveUser(response); })
            .always(() => { self.requestInProgress(false); });
    };

    self.requestUsers = function requestAllUsersFromBackend(force) {
        self.requestInProgress(true);
        return api.user.list(force)
            .done((response) => { self.processUsers(response); })
            .always(() => { self.requestInProgress(false); });
    };
};
