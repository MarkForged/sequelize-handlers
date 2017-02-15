var HttpStatusError = require('../errors/HttpStatusError'),
    plainTransform = require('../transforms/plain');

module.exports = init;

function init(model) {
    return [
        plainTransform,
        get
    ];
    
    function get(req, res, next) {
        var options = req.options || {};

        options.where = options.where || {};
        options.where[model.primaryKeyAttribute] = req.params.id;

        model
            .findOne(options)
            .then(respond)
            .catch(next);
        
        function respond(row) {
            if (row) {
                res.send(res.transform(row));
            } else {
                throw new HttpStatusError(404, 'Not Found');
            }
        }
    }
};