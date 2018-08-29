const _ = require('lodash');
const { HttpStatusError } = require('./errors');
const { parse } = require('./parser');
const { raw } = require('./transforms');

class ModelHandler {
    constructor(model, defaults = { limit: 50, offset: 0 }) {
        this.model = model;
        this.defaults = defaults;
    }
    
    create() {
        const handle = (req, res, next) => {
            this.model
                .create(req.body)
                .then(respond)
                .catch(next);
            
            function respond(row) {
                res.status(201);
                res.send(res.transform(row));
            }
        };
        
        return [
            raw,
            handle
        ];
    }
    
    get(options) {
        if (options != null) {
            var allowAssociations = options.allowAssociations;
        } else {
            var allowAssociations = false;
        };

        const handle = (req, res, next) => {
            var params = Object.assign(req.query, req.params);
            this
                .findOne(params, req.options, allowAssociations)
                .then(respond)
                .catch(next);
            
            function respond(row) {
                if (!row) {
                    throw new HttpStatusError(404, 'Not Found');
                }
                
                res.send(res.transform(row));
            }
        };
        
        return [
            raw,
            handle
        ];
    }
    
    query(options) {
        if (options != null) {
            var allowAssociations = options.allowAssociations;
        } else {
            var allowAssociations = false;
        };

        const handle = (req, res, next) => {
            this
                .findAndCountAll(req.query, req.options, false)
                .then(respond)
                .catch(next);
            
            function respond({ rows, start, end, count }) {
                res.set('Content-Range', `${start}-${end}/${count}`);
                if (count > end) {
                    res.status(206);
                } else {
                    res.status(200);
                }
                
                res.send(res.transform(rows));
            }
        };
        
        return [
            raw,
            handle
        ];
    }
    
    remove() {
        const handle = (req, res, next) => {
            this
                .findOne(req.params, null, false)
                .then(destroy)
                .then(respond)
                .catch(next);
            
            function destroy(row) {
                if (!row) {
                    throw new HttpStatusError(404, 'Not Found');
                }
                
                return row.destroy();
            }
            
            function respond() {
                res.sendStatus(204);
            }
        };
        
        return [
            handle
        ];
    }
    
    update() {
        const handle = (req, res, next) => {
            this
                .findOne(req.params, null, false)
                .then(updateAttributes)
                .then(respond)
                .catch(next);
                
            function updateAttributes(row) {
                if (!row) {
                    throw new HttpStatusError(404, 'Not Found');
                }
                
                return row.updateAttributes(req.body);
            }
            
            function respond(row) {
                res.send(res.transform(row));
            }
        };
        
        return [
            raw,
            handle
        ];
    }
    
    findOne(params, options, withAssociations) {
        options = _.merge(parse(params, this.model), options);

        if (!withAssociations) options.include = null;

        if (options.include != null) {
            for (var i = 0; i < options.include.length; i++) {
                options.include[i] = this.model.sequelize.models[options.include[i]];
            }
        }

        return this.model.findOne(options);
    }
    
    findAndCountAll(params, options, withAssociations) {
        let parsed = parse(params, this.model);
        
        options = _(parsed)
            .defaults(this.defaults)
            .merge(options)
            .value();

        if (!withAssociations) options.include = null;

        if (options.include != null) {
            for (var i = 0; i < options.include.length; i++) {
                options.include[i] = this.model.sequelize.models[options.include[i]];
            }
        }
        
        return this.model
            .findAndCountAll(options)
            .then(extract);
            
        function extract({ count, rows }) {
            const start = options.offset;
            const end = Math.min(count, (options.offset + options.limit) || count);
        
            return { rows, start, end, count };
        }
    }
}

module.exports = ModelHandler;