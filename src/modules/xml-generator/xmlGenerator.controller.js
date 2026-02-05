const xmlGeneratorService = require('./xmlGenerator.service');

const xmlGeneratorController = {
    /**
     * POST /xml/generate/:declarationId
     * Generate XML for declaration
     */
    async generate(req, res, next) {
        try {
            const { declarationId } = req.params;
            const userId = req.user.id;

            const result = await xmlGeneratorService.generate(declarationId, userId);

            res.json({
                success: true,
                data: {
                    id: result.id,
                    version: result.version,
                    xmlHash: result.xmlHash,
                    createdAt: result.createdAt,
                },
                message: `XML v${result.version} generated successfully`,
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({ success: false, error: error.message });
            }
            if (error.message.includes('No access')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            if (error.message.includes('must be validated')) {
                return res.status(422).json({ success: false, error: error.message });
            }
            next(error);
        }
    },

    /**
     * GET /xml/:declarationId/latest
     * Get latest XML for declaration
     */
    async getLatest(req, res, next) {
        try {
            const { declarationId } = req.params;
            const userId = req.user.id;

            const xml = await xmlGeneratorService.getLatest(declarationId, userId);

            if (!xml) {
                return res.status(404).json({
                    success: false,
                    error: 'No XML generated for this declaration',
                });
            }

            res.json({
                success: true,
                data: xml,
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({ success: false, error: error.message });
            }
            if (error.message.includes('No access')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            next(error);
        }
    },

    /**
     * GET /xml/:declarationId/download
     * Download latest XML as file
     */
    async download(req, res, next) {
        try {
            const { declarationId } = req.params;
            const userId = req.user.id;

            const xml = await xmlGeneratorService.getLatest(declarationId, userId);

            if (!xml) {
                return res.status(404).json({
                    success: false,
                    error: 'No XML generated for this declaration',
                });
            }

            // Set headers for file download
            const filename = `declaration_270_${declarationId}_v${xml.version}.xml`;
            res.setHeader('Content-Type', 'application/xml');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            res.send(xml.xml_content);
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({ success: false, error: error.message });
            }
            if (error.message.includes('No access')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            next(error);
        }
    },

    /**
     * GET /xml/:declarationId/versions
     * List all XML versions for declaration
     */
    async listVersions(req, res, next) {
        try {
            const { declarationId } = req.params;
            const userId = req.user.id;

            const versions = await xmlGeneratorService.listVersions(declarationId, userId);

            res.json({
                success: true,
                data: versions,
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({ success: false, error: error.message });
            }
            if (error.message.includes('No access')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            next(error);
        }
    },

    /**
     * GET /xml/version/:xmlId
     * Get specific XML version by ID
     */
    async getById(req, res, next) {
        try {
            const { xmlId } = req.params;
            const userId = req.user.id;

            const xml = await xmlGeneratorService.getById(xmlId, userId);

            res.json({
                success: true,
                data: xml,
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({ success: false, error: error.message });
            }
            if (error.message.includes('No access')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            next(error);
        }
    },

    /**
     * GET /xml/version/:xmlId/download
     * Download specific XML version
     */
    async downloadVersion(req, res, next) {
        try {
            const { xmlId } = req.params;
            const userId = req.user.id;

            const xml = await xmlGeneratorService.getById(xmlId, userId);

            const filename = `declaration_270_${xml.declaration_id}_v${xml.version}.xml`;
            res.setHeader('Content-Type', 'application/xml');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            res.send(xml.xml_content);
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({ success: false, error: error.message });
            }
            if (error.message.includes('No access')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            next(error);
        }
    },

    /**
     * POST /xml/:declarationId/validate
     * Validate XML structure
     */
    async validate(req, res, next) {
        try {
            const { declarationId } = req.params;
            const userId = req.user.id;

            const xml = await xmlGeneratorService.getLatest(declarationId, userId);

            if (!xml) {
                return res.status(404).json({
                    success: false,
                    error: 'No XML generated for this declaration',
                });
            }

            const validation = xmlGeneratorService.validateXmlStructure(xml.xml_content);

            res.json({
                success: true,
                data: {
                    isValid: validation.isValid,
                    errors: validation.errors,
                    xmlVersion: xml.version,
                    xmlHash: xml.xml_hash,
                },
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({ success: false, error: error.message });
            }
            if (error.message.includes('No access')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            next(error);
        }
    },
};

module.exports = xmlGeneratorController;
