/**
 * Threerouter sidebar shell: replaces the upstream SidebarRoot with
 * Threerouter-branded logo/wordmark while keeping the same layout,
 * collapse/expand animation, and child slot delegation.
 *
 * The slot contract is identical to the upstream SidebarRoot — the same
 * children (sidebar.workspaces, sidebar.settings, sidebar.footer.action)
 * are rendered via renderSlot(), declared by the upstream plugin.
 */
/**
 * Sidebar column shell with Threerouter branding.
 *
 * Props composition mirrors the upstream SidebarRootComponentProps:
 *   collapsed, width → runtime props from slot framework
 *   startSession, toggleSidebar → injected callbacks
 *   t → locale function
 *   renderSlot → child slot renderer (provided by slot framework)
 */
export declare function ThreerouterSidebar(props: any): import("react").JSX.Element;
