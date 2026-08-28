import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client';
import type { ISessions } from '@deepseek-ai/dsh-client-runtime/client';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { ThreerouterClientPlatform } from './environment.ts';
/** Component props injected by the threerouter client slot registration. */
export interface ThreerouterAuthUIProps {
    /** Shared wire client used to reach the host `/threerouter-auth` channel. */
    connection: ConnectionHandle;
    /** Session list face used to resolve the current session for model switching. */
    sessions: ISessions;
    /** Native platform controlling the caption-row offset. */
    platform: ThreerouterClientPlatform;
    t: TranslateNS<'threerouter'>;
}
/**
 * A floating chip in the top-right corner of the frame. Closed, it shows a
 * compact account pill (balance when signed in, login shortcut otherwise).
 * Open, it expands into a popover with login / profile / model-switch /
 * invite-share / logout actions.
 */
export declare function ThreerouterAuthUI({ connection, sessions, platform, t }: ThreerouterAuthUIProps): import("react").JSX.Element;
