export function moduleGuard(moduleName) {
    return (req, res, next) => {
        const enabledModules = req.app.get('enabledModules');
        if (!enabledModules.includes(moduleName)) {
            res.status(403).json({
                error: 'MODULE_NOT_LICENSED',
                message: `El módulo ${moduleName} no está incluido en su licencia.`,
                addon: moduleName,
            });
            return;
        }
        next();
    };
}
//# sourceMappingURL=moduleGuard.js.map