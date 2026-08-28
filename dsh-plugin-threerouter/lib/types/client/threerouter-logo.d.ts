/**
 * Threerouter brand logo components for the sidebar.
 *
 * Provides both a full wordmark (expanded sidebar) and a compact icon
 * (collapsed rail), matching the Threerouter brand identity.
 */
import type { IconProps } from '@deepseek-ai/dsh-client-ui-primitives';
/**
 * Compact icon logo used in the collapsed sidebar rail.
 * A stylised three-arc motif (three routes → threerouter).
 */
export declare function ThreerouterIcon({ size, className }: IconProps): import("react").JSX.Element;
/**
 * Compact brand mark shown in the advanced-shell sidebar caption (Windows) and
 * matching the product tray/window icon (`build/tray-icon.svg`): a deep-blue
 * rounded tile carrying a white "3" glyph. Built as a small inline SVG so the
 * renderer stays self-contained (the source asset is a 450 KB mesh export).
 */
export declare function ThreerouterBrandMark({ size, className }: IconProps): import("react").JSX.Element;
/**
 * Full wordmark logo used in the expanded sidebar.
 * Icon + "Threerouter" lettering.
 */
export declare function ThreerouterWordmark({ size, className }: IconProps): import("react").JSX.Element;
