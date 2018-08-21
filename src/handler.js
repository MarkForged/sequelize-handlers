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
    
    get() {
        const handle = (req, res, next) => {
            var params = Object.assign(req.query, req.params);
            this
                .findOne(params, req.options)
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
    
    query() {
        const handle = (req, res, next) => {
            var params = Object.assign(req.query, req.params);
            this
                .findAndCountAll(params, req.options)
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
            var params = Object.assign(req.query, req.params);
            this
                .findOne(params)
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
            var params = Object.assign(req.query, req.params);
            this
                .findOne(params)
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
    
    findOne(params, options, allowedArgs = ["where", "attributes", "limit", "offset", "order"]) {
        options = _.merge(parse(params, this.model), options);

        options = _.pick(options, ...allowedArgs);

        if (options.include != null) {
            for (var i = 0; i < options.include.length; i++) {
                options.include[i] = this.model.sequelize.models[options.include[i]];
            }
        }

        return this.model.findOne(options);
    }
    
    findAndCountAll(params, options, allowedArgs = ["where", "attributes", "limit", "offset", "order"]) {
        let parsed = parse(params, this.model);
        
        options = _(parsed)
            .defaults(this.defaults)
            .merge(options)
            .value();

        options = _.pick(options, ...allowedArgs)

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