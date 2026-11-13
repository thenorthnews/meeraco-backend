import { ok, serverError } from '../../helpers/response.helper.js';
import * as dashboardService from './dashboard.service.js';

export const getDashboardMetrics = async (req, res) => {
  try {
    const { period = 'year', branchId } = req.query;
    const data = await dashboardService.fetchDashboardData({
      period,
      branchId,
      user: req.user
    });

    return ok(res, 'Dashboard metrics fetched successfully', data);
  } catch (error) {
    return serverError(res, 'Failed to fetch dashboard metrics', error);
  }
};

