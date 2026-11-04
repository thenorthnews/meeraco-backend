import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ok, badRequest, serverError, paginated } from '../../helpers/response.helper.js';
import * as settingsService from './settings.service.js';
import { updateGeneralSettingsSchema } from './settings.validation.js';
import { paginationQuerySchema } from '../../validations/common.validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const uploadLogo = async (req, res) => {
  try {
    const { image, filename } = req.body;
    if (!image) {
      return badRequest(res, 'Image data is required');
    }

    let ext = 'png';
    let base64Data = image;
    if (image.startsWith('data:')) {
      const match = image.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (match) {
        ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        base64Data = match[2];
      }
    }

    const cleanFilename = `logo-${Date.now()}.${ext}`;
    const buffer = Buffer.from(base64Data, 'base64');

    // 1. Save to Backend public/uploads
    const backendUploads = path.join(__dirname, '../../../public/uploads');
    if (!fs.existsSync(backendUploads)) {
      fs.mkdirSync(backendUploads, { recursive: true });
    }
    fs.writeFileSync(path.join(backendUploads, cleanFilename), buffer);

    // 2. Also save to Frontend public/uploads for direct serving
    const frontendUploads = path.resolve(__dirname, '../../../../Frontend/meeraco-frontend/public/uploads');
    if (fs.existsSync(path.dirname(frontendUploads))) {
      if (!fs.existsSync(frontendUploads)) {
        fs.mkdirSync(frontendUploads, { recursive: true });
      }
      fs.writeFileSync(path.join(frontendUploads, cleanFilename), buffer);
    }

    const logoUrl = `/uploads/${cleanFilename}`;

    await settingsService.saveGeneralSettings({ logoUrl });
    await settingsService.saveCompanyProfile({ logoUrl });

    return ok(res, 'Logo uploaded successfully', { url: logoUrl });
  } catch (error) {
    return serverError(res, 'Failed to upload logo', error);
  }
};

export const getCompanyProfile = async (req, res) => {
  try {
    const profile = await settingsService.fetchCompanyProfile();
    return ok(res, 'Company profile fetched successfully', profile);
  } catch (error) {
    return serverError(res, 'Failed to fetch company profile', error);
  }
};

export const updateCompanyProfile = async (req, res) => {
  try {
    const updated = await settingsService.saveCompanyProfile(req.body);
    return ok(res, 'Company profile updated successfully', updated);
  } catch (error) {
    return serverError(res, 'Failed to update company profile', error);
  }
};

export const getGeneralSettings = async (req, res) => {
  try {
    const settings = await settingsService.fetchGeneralSettings();
    return ok(res, 'General settings fetched successfully', settings);
  } catch (error) {
    return serverError(res, 'Failed to fetch general settings', error);
  }
};

export const updateGeneralSettings = async (req, res) => {
  try {
    const { error, value } = updateGeneralSettingsSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return badRequest(res, error.details.map(d => d.message).join(', '));
    }

    const updated = await settingsService.saveGeneralSettings(value);
    return ok(res, 'General settings updated successfully', updated);
  } catch (error) {
    return serverError(res, 'Failed to update general settings', error);
  }
};

export const getLeadMasters = async (req, res) => {
  try {
    const { type } = req.query;
    const masters = await settingsService.fetchLeadMasters(type);
    return ok(res, 'Lead masters fetched successfully', masters);
  } catch (error) {
    return serverError(res, 'Failed to fetch lead masters', error);
  }
};

export const getAssignmentRules = async (req, res) => {
  try {
    const rules = await settingsService.fetchAssignmentRules();
    return ok(res, 'Assignment rules fetched successfully', rules);
  } catch (error) {
    return serverError(res, 'Failed to fetch assignment rules', error);
  }
};

export const getAuditLogs = async (req, res) => {
  try {
    const { error: queryErr } = paginationQuerySchema.validate(req.query, { abortEarly: false, stripUnknown: false });
    if (queryErr) {
      return badRequest(res, queryErr.details.map(d => d.message).join(', '));
    }

    const { module, userId, page = 1, limit = 50 } = req.query;
    const result = await settingsService.fetchAuditLogs({ module, userId, page, limit });

    return paginated(res, {
      items: result.logs,
      total: result.total,
      page: result.pageNum,
      limit: result.limitNum,
      message: 'Audit logs fetched successfully'
    });
  } catch (error) {
    return serverError(res, 'Failed to fetch audit logs', error);
  }
};
