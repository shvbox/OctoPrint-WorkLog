/* global WorkLog Object */

WorkLog.prototype.core.common = function pluginCommonValues() {
    const self = this.core.common;

    self.jobStatus = {
        STATUS_FAIL_USER: -2,
        STATUS_FAIL_SYS: -1,
        STATUS_UNDEFINED: 0,
        STATUS_SUCCESS: 1,
    };

    Object.freeze(self.jobStatus);
};
