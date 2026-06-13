/**
 * Shared types for HostelDesk.
 * Expanded in later tickets with database entity types.
 */

/** Navigation item definition */
export interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}
