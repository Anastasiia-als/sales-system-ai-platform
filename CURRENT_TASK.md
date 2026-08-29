# Current Task: Phase 6B - Template Cloning & Advanced Delivery Orchestration

Phase 6B is active.

## Scope
1. **Version Control Cloning (create_template_draft)**: Ability to take a `published` template version and create a new `draft` version. This requires deep-cloning all stages, milestones, tasks, documents, and meetings, mapping their old IDs to new IDs.
2. **Template Duplication (clone_project_template)**: Ability to duplicate an entire Template into a new Template for cross-pollination of best practices.
3. **UI Integration**: Update `portal-template-builder-view.js` and `portal-templates-view.js` to replace the "Phase 6B" alert with actual functional buttons.

## Definition of Done
- RPC `create_template_draft` implemented and tested.
- RPC `clone_project_template` implemented and tested.
- UI buttons wired up.
- Master Regression suite updated and passing (192+ tests).
- Browser E2E passing.
- RLS verified (cross-tenant cloning blocked).
