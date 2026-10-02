// Plan templates ("default plans") — per-church saved starting points for new
// plans: time, title, pre-service notes and a running order (service items +
// empty song slots). Created/updated by snapshotting an existing plan.
// See project doc claude/plan-templates.md.
//
//   GET    /api/plan-templates                 any member
//   POST   /api/plan-templates                 { plan_id, name }   save a plan as a new template
//   PUT    /api/plan-templates/:id             { name, title, plan_time, plan_start_time, plan_sort_order, pre_service_notes }
//   PUT    /api/plan-templates/:id/from-plan   { plan_id }         overwrite running order etc. from a plan
//   DELETE /api/plan-templates/:id
// Writes need admin or can_add_plans (same people who can create plans).

const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth, requireMembership, requirePermission } = require('../middleware/auth');
const { normaliseTemplateItems, cleanText } = require('../utils/planTemplateItems');

const canWrite = requirePermission('can_add_plans');

const COLUMNS = 'id, name, title, plan_time, plan_start_time, plan_sort_order, pre_service_notes, items, updated_at';

// Loads a plan (scoped to the church) and turns it into template fields.
async function snapshotPlan(planId, churchId) {
  const plan = await pool.query(
    'SELECT title, plan_time, plan_start_time, plan_sort_order, pre_service_notes FROM plans WHERE id=$1 AND church_id=$2',
    [planId, churchId]
  );
  if (plan.rows.length === 0) return null;
  const items = await pool.query(
    'SELECT type, title, notes, content, duration_minutes, phase FROM plan_items WHERE plan_id=$1 ORDER BY position',
    [planId]
  );
  const p = plan.rows[0];
  return {
    title: p.title || null,
    plan_time: p.plan_time || null,
    plan_start_time: p.plan_start_time || null,
    plan_sort_order: p.plan_sort_order ?? 0,
    pre_service_notes: p.pre_service_notes || null,
    items: normaliseTemplateItems(items.rows),
  };
}

router.get('/', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT ${COLUMNS} FROM plan_templates WHERE church_id=$1 ORDER BY plan_sort_order, plan_start_time NULLS LAST, LOWER(name)`,
      [req.churchId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, canWrite, async function(req, res, next) {
  try {
    const name = cleanText(req.body.name, 100);
    if (!name) return res.status(400).json({ error: 'Template name is required' });
    if (!req.body.plan_id) return res.status(400).json({ error: 'plan_id is required' });

    const snap = await snapshotPlan(req.body.plan_id, req.churchId);
    if (!snap) return res.status(404).json({ error: 'Plan not found' });

    const result = await pool.query(
      `INSERT INTO plan_templates (church_id, name, title, plan_time, plan_start_time, plan_sort_order, pre_service_notes, items, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${COLUMNS}`,
      [req.churchId, name, snap.title, snap.plan_time, snap.plan_start_time, snap.plan_sort_order, snap.pre_service_notes, JSON.stringify(snap.items), req.user.clerk_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, canWrite, async function(req, res, next) {
  try {
    const name = cleanText(req.body.name, 100);
    if (!name) return res.status(400).json({ error: 'Template name is required' });
    const sortOrder = parseInt(req.body.plan_sort_order, 10);

    const result = await pool.query(
      `UPDATE plan_templates
         SET name=$1, title=$2, plan_time=$3, plan_start_time=$4, plan_sort_order=$5, pre_service_notes=$6, updated_at=NOW()
       WHERE id=$7 AND church_id=$8 RETURNING ${COLUMNS}`,
      [
        name,
        cleanText(req.body.title, 200),
        cleanText(req.body.plan_time, 50),
        req.body.plan_start_time || null,
        Number.isFinite(sortOrder) ? sortOrder : 0,
        cleanText(req.body.pre_service_notes, 5000),
        req.params.id,
        req.churchId,
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/from-plan', requireAuth, canWrite, async function(req, res, next) {
  try {
    if (!req.body.plan_id) return res.status(400).json({ error: 'plan_id is required' });
    const snap = await snapshotPlan(req.body.plan_id, req.churchId);
    if (!snap) return res.status(404).json({ error: 'Plan not found' });

    const result = await pool.query(
      `UPDATE plan_templates
         SET title=$1, plan_time=$2, plan_start_time=$3, plan_sort_order=$4, pre_service_notes=$5, items=$6, updated_at=NOW()
       WHERE id=$7 AND church_id=$8 RETURNING ${COLUMNS}`,
      [snap.title, snap.plan_time, snap.plan_start_time, snap.plan_sort_order, snap.pre_service_notes, JSON.stringify(snap.items), req.params.id, req.churchId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, canWrite, async function(req, res, next) {
  try {
    const result = await pool.query(
      'DELETE FROM plan_templates WHERE id=$1 AND church_id=$2 RETURNING id',
      [req.params.id, req.churchId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
