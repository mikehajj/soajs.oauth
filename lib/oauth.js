'use strict';
var fs = require("fs");
var userCollectionName = "oauth_urac";
var tokenCollectionName = "oauth_token";

var soajsCoreModules = require('soajs');
var coreHasher = soajsCoreModules.hasher;

var Auth = soajsCoreModules.authorization;

function checkIfError(req, mainCb, data, cb) {
    if (data.error) {
        if (typeof (data.error) === 'object' && data.error.message) {
            req.soajs.log.error(data.error);
        }
        return mainCb({"code": data.code, "msg": req.soajs.config.errors[data.code]});
    }
    else {
        return cb();
    }
}

var libProduct = {
    "model": null,

    /**
     * Get the user record from the database, and validate password
     * @param {Request Object} soajs
     * @param {Callback Function} cb
     */
    "getUserRecord": function (req, cb) {
        var config = req.soajs.config;

        var loginMode = config.loginMode;
        if (req.soajs.tenantOauth && req.soajs.tenantOauth.loginMode) {
            loginMode = req.soajs.tenantOauth.loginMode;
        }

        function getLocal() {
            var condition = {'userId': req.soajs.inputmaskData['username']};
            var combo = {
                collection: userCollectionName,
                condition: condition
            };
            libProduct.model.findEntry(req.soajs, combo, function (err, record) {
                if (record) {
                    var hashConfig = {
                        "hashIterations": config.hashIterations,
                        "seedLength": config.seedLength
                    };
                    if (req.soajs.servicesConfig && req.soajs.servicesConfig.oauth) {
                        if (req.soajs.servicesConfig.oauth.hashIterations && req.soajs.servicesConfig.oauth.seedLength) {
                            hashConfig = {
                                "hashIterations": req.soajs.servicesConfig.oauth.hashIterations,
                                "seedLength": req.soajs.servicesConfig.oauth.seedLength
                            };
                        }
                    }
                    coreHasher.init(hashConfig);
                    coreHasher.compare(req.soajs.inputmaskData.password, record.password, function (err, result) {
                        if (err || !result) {
                            return cb(413);
                        }

                        delete record.password;
                        if (record.tId && req.soajs.tenant) {
                            if (record.tId.toString() !== req.soajs.tenant.id) {
                                return cb(403);
                            }
                        }
                        //TODO: keys here
                        if (record) {
                            record.loginMode = loginMode;
                        }

                        return cb(null, record);
                    });
                }
                else {
                    req.soajs.log.error("Username " + req.soajs.inputmaskData['username'] + " not found");
                    return cb(401);
                }
            });
        }

        if (loginMode === 'urac') {
            var uracDriver = require("soajs.urac.driver");
            var data = {
                'username': req.soajs.inputmaskData['username'],
                'password': req.soajs.inputmaskData['password']
            };
            uracDriver.login(req.soajs, data, function (errCode, record) {
                if (errCode) {
                    return cb(errCode);
                }

                if (record) {
                    record.loginMode = loginMode;
                }
                return cb(null, record);
            });
        }
        else {
            getLocal();
        }

    },

    /**
     * Delete All tokens of a user
     * @param {Request Object} soajs
     * @param {Callback Function} cb
     */
    "deleteAllTokens": function (req, cb) {
        var config = req.soajs.config;

        var loginMode = config.loginMode;
        if (req.soajs.tenantOauth && req.soajs.tenantOauth.loginMode) {
            loginMode = req.soajs.tenantOauth.loginMode;
        }

        var criteria = {
            "user.loginMode": loginMode,
            "user.id": req.soajs.inputmaskData.userId
        };
        var combo = {
            collection: tokenCollectionName,
            condition: criteria
        };
       
        libProduct.model.removeEntry(req.soajs, combo, function (error, result) {
            var data = {config: req.soajs.config, error: error, code: 404};
            checkIfError(req, cb, data, function () {
                return cb(null, result.result);
            });
        });
    },

    /**
     * Delete All tokens of a client
     * @param {Request Object} soajs
     * @param {Callback Function} cb
     */
    "deauthorize": function (req, cb) {
        var criteria = {
            "clientId": req.soajs.inputmaskData.clientId
        };
        var combo = {
            collection: tokenCollectionName,
            condition: criteria
        };
        libProduct.model.removeEntry(req.soajs, combo, function (error, result) {
            var data = {config: req.soajs.config, error: error, code: 404};
            checkIfError(req, cb, data, function () {
                return cb(null, result.result);
            });
        });
    },

    /**
     * Delete one refresh token
     * @param {Request Object} soajs
     * @param {Callback Function} cb
     */
    "deleteRefreshToken": function (req, cb) {
        var criteria = {
            "token": req.soajs.inputmaskData.token,
            "type": "refreshToken"
        };
        var combo = {
            collection: tokenCollectionName,
            condition: criteria
        };
        libProduct.model.removeEntry(req.soajs, combo, function (error, result) {
            var data = {config: req.soajs.config, error: error, code: 404};
            checkIfError(req, cb, data, function () {
                return cb(null, result.result);
            });
        });
    },

    /**
     * Delete one access token
     * @param {Request Object} soajs
     * @param {Callback Function} cb
     */
    "deleteAccessToken": function (req, cb) {
        var criteria = {
            "token": req.soajs.inputmaskData.token,
            "type": "accessToken"
        };
        var combo = {
            collection: tokenCollectionName,
            condition: criteria
        };
        libProduct.model.removeEntry(req.soajs, combo, function (error, result) {
            var data = {config: req.soajs.config, error: error, code: 404};
            checkIfError(req, cb, data, function () {
                return cb(null, result.result);
            });
        });
    },

    /**
     * Generate the the authorization value
     * @param {Request Object} soajs
     * @param {Callback Function} cb
     */
    "generateAuthValue": function (req, cb) {
        /*
        var id;
        try {
            id = libProduct.model.validateId(req.soajs, req.soajs.tenant.id);
        }
        catch (e) {
            return cb({"code": 405, "msg": req.soajs.config.errors[405]});
        }
        var criteria = {
            "_id": id
        };
        var combo = {
            collection: 'tenants',
            condition: criteria
        };
        libProduct.model.findEntry(req.soajs, combo, function (error, record) {
            var oauthSecret;
            if (record.oauth && record.oauth.secret) {
                oauthSecret = record.oauth.secret;
            }
            else {
                return cb({"code": 406, "msg": req.soajs.config.errors[406]});
            }
*/
            if (req.soajs && req.soajs.tenantOauth && req.soajs.tenantOauth.secret && req.soajs.tenant && req.soajs.tenant.id){
                let secret =  req.soajs.tenantOauth.secret;
                let tenantId =  req.soajs.tenant.id.toString();

                var basic = Auth.generate(tenantId, secret);
                return cb(null, basic);
            }
            else
                return cb({"code": 406, "msg": req.soajs.config.errors[406]});

        //});
    }
};

module.exports = {
    "init": function (modelName, cb) {
        var modelPath = __dirname + "/../model/" + modelName + ".js";
        return requireModel(modelPath, cb);

        /**
         * checks if model file exists, requires it and returns it.
         * @param filePath
         * @param cb
         */
        function requireModel(filePath, cb) {
            //check if file exist. if not return error
            fs.exists(filePath, function (exists) {
                if (!exists) {
                    return cb(new Error("Requested Model Not Found!"));
                }

                libProduct.model = require(filePath);
                return cb(null, libProduct);
            });
        }
    }
};