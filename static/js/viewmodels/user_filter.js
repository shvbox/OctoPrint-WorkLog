/* global WorkLog ko Utils */

WorkLog.prototype.viewModels.userFilter = function userFilterViewModel() {
    const self = this.viewModels.userFilter;
    const api = this.core.client;
    const history = this.viewModels.jobs;
    
    const loginLib = this.core.bridge.allViewModels.loginStateViewModel;
    
    self.allItems = ko.observableArray([]);
    self.selected = ko.observable();
    self.requestInProgress = ko.observable(false);
    
    self.userChanged = false;
    loginLib.currentUser.subscribe(() => { self.userChanged = true; });

    history.allJobs.addFilter('user');
    
    self.changed = function userFilterChanged() {
        history.onFilterChanged();
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
