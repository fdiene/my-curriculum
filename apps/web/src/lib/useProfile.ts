import { ref } from "vue";
import type { Lang, Resume, TargetRole } from "@profile/schema";
import { buildProfile, type Profile } from "@profile/core";
import { api } from "./client";
import fallbackJson from "../../../../data/master_data.i18n.json";

export type ProfileStatus = "loading" | "ready" | "error" | "degraded";
export type ProfileClient = (role: TargetRole, lang: Lang) => Promise<Profile>;

const FETCH_TIMEOUT_MS = 4000;
const FALLBACK = fallbackJson as unknown as Resume;

const edenClient: ProfileClient = async (role, lang) => {
  const { data, error } = await api.v1.profile.build.get({ query: { target_role: role, lang } });
  if (error || !data) throw new Error("api error");
  return data;
};

export function useProfile(
  initial: { role: TargetRole; lang: Lang },
  opts: { client?: ProfileClient; timeoutMs?: number } = {},
) {
  const client = opts.client ?? edenClient;
  const timeoutMs = opts.timeoutMs ?? FETCH_TIMEOUT_MS;
  const role = ref<TargetRole>(initial.role);
  const lang = ref<Lang>(initial.lang);
  const status = ref<ProfileStatus>("loading");
  const profile = ref<Profile | null>(null);
  const lastRequest = ref("");
  let generation = 0;

  async function fetchProfile(): Promise<void> {
    const gen = ++generation;
    if (!profile.value) status.value = "loading";
    lastRequest.value = `/v1/profile/build?target_role=${role.value}&lang=${lang.value}`;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    });
    try {
      const result = await Promise.race([client(role.value, lang.value), timeout]);
      if (gen !== generation) return;
      profile.value = result;
      status.value = "ready";
    } catch {
      if (gen !== generation) return;
      profile.value = buildProfile(role.value, lang.value, FALLBACK);
      status.value = "degraded";
    } finally {
      clearTimeout(timer);
    }
  }
  async function setRole(r: TargetRole) { role.value = r; await fetchProfile(); }
  async function setLang(l: Lang) { lang.value = l; await fetchProfile(); }
  const retry = fetchProfile;

  return { role, lang, status, profile, lastRequest, fetchProfile, setRole, setLang, retry };
}
