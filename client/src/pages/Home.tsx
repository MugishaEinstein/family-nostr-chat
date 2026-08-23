import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, KeyRound, LoaderCircle, LockKeyhole, Radio, ShieldCheck, UsersRound } from "lucide-react";
import type { Relay } from "nostr-tools";
import type { Subscription } from "nostr-tools/abstract-relay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import MessengerWorkspace from "@/components/MessengerWorkspace";
import { trpc } from "@/lib/trpc";
import {
  buildRelay,
  clearFamilyContext,
  generateIdentity,
  getStoredFamilyContext,
  getStoredIdentity,
  getStoredRelay,
  identityFromSecret,
  isFamilyRoomMessage,
  normalizeRelayUrl,
  publishFamilyMessage,
  storeFamilyContext,
  storeIdentity,
  storeMembers,
  storeRelay,
  type FamilyContext,
  type FamilyMember,
  type FamilyMessage,
  type LocalIdentity,
  unwrapFamilyMessage,
} from "@/lib/nostr";
import { toast } from "sonner";

const sealUrl = "/manus-storage/hearthline-seal_f89e7d2b.png";
const roomArtworkUrl = "/manus-storage/hearthline-warm-room_0cc1ba24.jpg";
type ConnectionState = "idle" | "connecting" | "connected" | "error";
type SetupMode = "create" | "join";
const EMPTY_FAMILY_ID = "00000000-0000-0000-0000-000000000000";

function defaultRelay() {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  return host.startsWith("chat.") ? `wss://relay.${host}` : "";
}

function memberFromRecord(record: { id: number; displayName: string; pubkey: string }) : FamilyMember {
  return { id: String(record.id), name: record.displayName, pubkey: record.pubkey };
}

export default function Home() {
  const [identity, setIdentity] = useState<LocalIdentity | null>(() => getStoredIdentity());
  const [family, setFamily] = useState<FamilyContext | null>(() => getStoredFamilyContext());
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [relayUrl, setRelayUrl] = useState(() => getStoredRelay());
  const [settingsRelayUrl, setSettingsRelayUrl] = useState(() => getStoredRelay());
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [connectionNote, setConnectionNote] = useState("Not connected");
  const [messages, setMessages] = useState<FamilyMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [setupMode, setSetupMode] = useState<SetupMode>("create");
  const [setupName, setSetupName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [setupRelay, setSetupRelay] = useState(defaultRelay);
  const [inviteCode, setInviteCode] = useState("");
  const [importSecret, setImportSecret] = useState("");
  const [showImport, setShowImport] = useState(false);
  const relayRef = useRef<Relay | null>(null);
  const subscriptionRef = useRef<Subscription | null>(null);
  const allowedKeysRef = useRef<string[]>([]);
  const authRetryTimerRef = useRef<number | null>(null);

  const membersQuery = trpc.family.members.useQuery(
    { familyId: family?.id ?? EMPTY_FAMILY_ID },
    { enabled: Boolean(identity && family), refetchInterval: 30_000 },
  );
  const createFamily = trpc.family.create.useMutation();
  const joinFamily = trpc.family.join.useMutation();
  const createInvite = trpc.family.createInvite.useMutation();
  const removeMember = trpc.family.removeMember.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (membersQuery.data) {
      const next = membersQuery.data.map(memberFromRecord);
      setMembers(next);
      storeMembers(next);
    }
  }, [membersQuery.data]);

  const visibleMembers = useMemo(() => members, [members]);
  const memberByKey = useMemo(() => new Map(members.map((member) => [member.pubkey, member])), [members]);
  allowedKeysRef.current = members.map((member) => member.pubkey);

  const addMessage = (message: FamilyMessage) => {
    setMessages((current) => current.some((entry) => entry.id === message.id) ? current : [...current, message].sort((a, b) => a.createdAt - b.createdAt));
  };

  const disconnect = () => {
    if (authRetryTimerRef.current !== null) window.clearTimeout(authRetryTimerRef.current);
    authRetryTimerRef.current = null;
    subscriptionRef.current?.close();
    subscriptionRef.current = null;
    relayRef.current?.close();
    relayRef.current = null;
    setConnection("idle");
    setConnectionNote("Not connected");
  };

  const connect = async (requestedRelay: string, requestedIdentity: LocalIdentity, requestedFamily: FamilyContext) => {
    try {
      const normalized = normalizeRelayUrl(requestedRelay);
      disconnect();
      setConnection("connecting");
      setConnectionNote("Opening your private family room…");
      const relay = buildRelay(normalized, requestedIdentity);
      relay.onnotice = (notice) => setConnectionNote(notice || "Relay sent a notice.");
      relay.onclose = () => { setConnection("error"); setConnectionNote("Relay connection closed."); };
      await relay.connect();
      relayRef.current = relay;
      setRelayUrl(normalized);
      setSettingsRelayUrl(normalized);
      storeRelay(normalized);
      setConnection("connected");
      setConnectionNote("Private family space connected");

      const subscribe = () => {
        subscriptionRef.current?.close();
        subscriptionRef.current = relay.subscribe(
          [{ kinds: [1059], "#p": [requestedIdentity.pubkey], "#h": [requestedFamily.id], limit: 200 }],
          {
            onevent: (event) => {
              const message = unwrapFamilyMessage(event, requestedIdentity);
              if (message && isFamilyRoomMessage(message, allowedKeysRef.current, requestedFamily.id)) addMessage(message);
            },
            onclose: (reason) => {
              if (reason?.startsWith("auth-required:")) {
                setConnectionNote("Authenticating your private room…");
                authRetryTimerRef.current = window.setTimeout(subscribe, 850);
                return;
              }
              if (reason) setConnectionNote(reason);
            },
          },
        );
      };
      subscribe();
      return true;
    } catch (error) {
      setConnection("error");
      setConnectionNote(error instanceof Error ? error.message : "Unable to reach the relay.");
      return false;
    }
  };

  useEffect(() => {
    if (identity && family) void connect(family.relayUrl, identity, family);
    return () => disconnect();
    // Relay lifecycle is coordinated by explicit family and device actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistFamily = async (nextIdentity: LocalIdentity, nextFamily: FamilyContext) => {
    storeIdentity(nextIdentity);
    storeFamilyContext(nextFamily);
    storeRelay(nextFamily.relayUrl);
    setIdentity(nextIdentity);
    setFamily(nextFamily);
    setRelayUrl(nextFamily.relayUrl);
    setSettingsRelayUrl(nextFamily.relayUrl);
    setMessages([]);
    await connect(nextFamily.relayUrl, nextIdentity, nextFamily);
    await utils.family.members.invalidate({ familyId: nextFamily.id });
  };

  const beginCreate = async (restoredIdentity?: LocalIdentity) => {
    try {
      const nextIdentity = restoredIdentity ?? generateIdentity();
      storeIdentity(nextIdentity);
      const result = await createFamily.mutateAsync({
        name: familyName,
        displayName: setupName || "Family owner",
        relayUrl: normalizeRelayUrl(setupRelay),
      });
      const nextFamily: FamilyContext = { id: result.id, name: result.name, relayUrl: result.relayUrl, role: "owner" };
      await persistFamily(nextIdentity, nextFamily);
      await navigator.clipboard?.writeText(result.inviteCode);
      toast.success("Family space created. Your first invite code is copied.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not create your family space.");
    }
  };

  const beginJoin = async (restoredIdentity?: LocalIdentity) => {
    try {
      const nextIdentity = restoredIdentity ?? generateIdentity();
      storeIdentity(nextIdentity);
      const result = await joinFamily.mutateAsync({ code: inviteCode, displayName: setupName || "Family member" });
      const nextFamily: FamilyContext = { id: result.id, name: result.name, relayUrl: result.relayUrl, role: result.role };
      await persistFamily(nextIdentity, nextFamily);
      toast.success(`You joined ${result.name}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not join that family space.");
    }
  };

  const importAndContinue = async () => {
    try {
      const restored = identityFromSecret(importSecret);
      if (setupMode === "create") await beginCreate(restored);
      else await beginJoin(restored);
      setImportSecret("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That private key could not be imported.");
    }
  };

  const sendMessage = async () => {
    if (!identity || !family || !relayRef.current || !draft.trim()) return;
    setIsSending(true);
    try {
      await publishFamilyMessage(relayRef.current, identity, members.map((member) => member.pubkey), draft, family.id);
      setDraft("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The message could not be delivered.");
    } finally {
      setIsSending(false);
    }
  };

  const handleCreateInvite = async () => {
    if (!family) return null;
    try {
      const result = await createInvite.mutateAsync({ familyId: family.id, label: "Family invite", maxUses: 10, expiresInDays: 30 });
      await navigator.clipboard?.writeText(result.code);
      toast.success("Invite code copied. It expires in 30 days or after 10 uses.");
      return result.code;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The invite could not be created.");
      return null;
    }
  };

  const handleRemoveMember = async (pubkey: string) => {
    if (!family) return;
    try {
      await removeMember.mutateAsync({ familyId: family.id, pubkey });
      await utils.family.members.invalidate({ familyId: family.id });
      toast.success("Member access removed from this family space.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The member could not be removed.");
    }
  };

  const forgetDevice = () => {
    disconnect();
    localStorage.removeItem("hearthline.identity.v1");
    localStorage.removeItem("hearthline.members.v1");
    localStorage.removeItem("hearthline.settings.v1");
    clearFamilyContext();
    setIdentity(null);
    setFamily(null);
    setMembers([]);
    setMessages([]);
  };

  if (!identity || !family) {
    const isCreate = setupMode === "create";
    return (
      <main className="setup-page min-h-screen text-[#302C28]">
        <section className="setup-grid min-h-screen">
          <div className="relative flex min-h-[54vh] flex-col justify-between overflow-hidden bg-[#2F2E2A] px-6 py-7 text-[#F7F2E9] sm:px-10 sm:py-10 lg:min-h-screen lg:px-14 lg:py-12">
            <img src={roomArtworkUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50 mix-blend-luminosity" />
            <div className="absolute inset-0 bg-[linear-gradient(125deg,rgba(54,45,38,.82),rgba(92,54,43,.5)_57%,rgba(47,46,42,.28))]" />
            <div className="setup-paper-noise" />
            <div className="relative flex items-center gap-3"><img src={sealUrl} alt="Family Chat" className="h-11 w-11 rounded-full bg-[#F7F2E9] p-1.5" /><div className="flex flex-col leading-none"><span className="font-['Fraunces'] text-[1.42rem] font-semibold tracking-[-.045em] text-[#FFF9F2]">Family Chat</span><span className="mt-1.5 font-['DM_Sans'] text-[.55rem] font-bold tracking-[.17em] text-[#E7C3A5] uppercase">Private family messenger</span></div></div>
            <div className="relative max-w-xl py-10 lg:pb-20"><p className="mb-5 font-['DM_Sans'] text-xs font-bold tracking-[0.18em] text-[#E3AA78] uppercase">Your own private space</p><h1 className="font-['Fraunces'] text-5xl leading-[.97] tracking-[-0.045em] sm:text-6xl lg:text-7xl">A room for the people you keep close.</h1><p className="mt-7 max-w-md font-['DM_Sans'] text-base leading-7 text-[#E7DDD0]">Create a private space for your family, or join one with a family invite.</p></div>
            <div className="relative flex items-center gap-3 border-l-2 border-[#D98C75] pl-3 font-['DM_Sans'] text-xs text-[#E7D4C1]"><ShieldCheck className="h-4 w-4 shrink-0 text-[#F1B185]" /><span><strong className="font-semibold text-[#FFF4E8]">Quietly yours.</strong> Your device key remains in this browser.</span></div>
          </div>
          <div className="relative flex items-center overflow-hidden bg-[#F7F2E9] px-6 py-12 sm:px-10 lg:px-16 lg:py-16"><div className="setup-binding" aria-hidden="true"><span /><span /><span /></div><div className="setup-ledger mx-auto w-full max-w-md"><div className="mb-8"><p className="eyebrow">Family Chat</p><h2 className="mt-3 font-['Fraunces'] text-4xl tracking-[-0.04em] text-[#302C28]">{isCreate ? "Create your family space" : "Join your family space"}</h2><p className="mt-3 font-['DM_Sans'] text-sm leading-6 text-[#726A61]">{isCreate ? "You will become the owner and receive a shareable invite code." : "Enter the invite shared by a family owner to join their private room."}</p></div>
            <div className="mb-6 grid grid-cols-2 rounded-2xl border border-[#E0D4C5] bg-[#FFFDF8] p-1"><button type="button" onClick={() => setSetupMode("create")} className={`rounded-xl px-3 py-2.5 font-['DM_Sans'] text-sm font-bold ${isCreate ? "bg-[#A83D32] text-white" : "text-[#715E51]"}`}>Create a space</button><button type="button" onClick={() => setSetupMode("join")} className={`rounded-xl px-3 py-2.5 font-['DM_Sans'] text-sm font-bold ${!isCreate ? "bg-[#A83D32] text-white" : "text-[#715E51]"}`}>Join with invite</button></div>
            <div className="ledger-form space-y-5"><div className="ledger-section-label"><span>01</span><p>Your device</p></div><label className="field-label"><span>Your name</span><Input value={setupName} onChange={(event) => setSetupName(event.target.value)} placeholder="For example, Jean" className="hearth-input mt-2" /></label>{isCreate ? <><div className="ledger-section-label pt-1"><span>02</span><p>Your new family space</p></div><label className="field-label"><span>Family name</span><Input value={familyName} onChange={(event) => setFamilyName(event.target.value)} placeholder="For example, The Nsimba family" className="hearth-input mt-2" /></label><label className="field-label"><span>Shared relay address</span><Input value={setupRelay} onChange={(event) => setSetupRelay(event.target.value)} placeholder="wss://relay.example.com" className="hearth-input mt-2" /></label></> : <><div className="ledger-section-label pt-1"><span>02</span><p>Your family invite</p></div><label className="field-label"><span>Invite code</span><Input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="FAMILY-XXXXXXX-XXXXXXX" className="hearth-input mt-2 font-mono text-sm" autoComplete="off" /></label></>}</div>
            {showImport ? <div className="mt-5 rounded-2xl border border-[#D8CCBD] bg-[#FFFDF8] p-4"><label className="field-label"><span>Import an nsec or hex secret</span><Textarea value={importSecret} onChange={(event) => setImportSecret(event.target.value)} placeholder="nsec1…" className="hearth-input mt-2 min-h-24 resize-none font-mono text-xs" /></label><Button onClick={() => void importAndContinue()} className="hearth-primary mt-4 w-full">Use this device key</Button></div> : <Button onClick={() => void (isCreate ? beginCreate() : beginJoin())} disabled={createFamily.isPending || joinFamily.isPending} className="hearth-primary mt-7 w-full">{createFamily.isPending || joinFamily.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}{isCreate ? "Create Family Chat" : "Join Family Chat"}<ArrowUp className="ml-2 h-4 w-4" /></Button>}
            <button type="button" onClick={() => setShowImport((current) => !current)} className="mt-5 flex w-full items-center justify-center gap-2 font-['DM_Sans'] text-xs font-bold text-[#8C4D42] underline-offset-4 hover:underline"><KeyRound className="h-3.5 w-3.5" />{showImport ? "Use a new device key instead" : "I already have a device key"}</button>
            <div className="trust-marginalia mt-8"><div><ShieldCheck className="h-4 w-4" /><p><strong>Your key stays here.</strong> It signs and opens messages on this device.</p></div><div><Radio className="h-4 w-4" /><p><strong>Family spaces stay apart.</strong> Each family has separate members and invites.</p></div><div><UsersRound className="h-4 w-4" /><p><strong>Owners stay in control.</strong> Create, revoke, and share invites from the room.</p></div></div>
          </div></div>
        </section>
      </main>
    );
  }

  return <MessengerWorkspace identity={identity} familyName={family.name} familyRole={family.role} visibleMembers={visibleMembers} members={members} memberByKey={memberByKey} messages={messages} connection={connection} connectionNote={connectionNote} relayUrl={relayUrl} settingsRelayUrl={settingsRelayUrl} setSettingsRelayUrl={setSettingsRelayUrl} draft={draft} setDraft={setDraft} isSending={isSending} onSend={() => void sendMessage()} onCreateInvite={handleCreateInvite} onRemoveMember={(pubkey) => void handleRemoveMember(pubkey)} onUpdateRelay={() => void connect(settingsRelayUrl, identity, family)} onForgetDevice={forgetDevice} />;
}
