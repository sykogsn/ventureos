"use client";

import { useSearchParams } from "next/navigation";
import {
  AUTH_EXPERIENCE,
  AUTH_MARK,
  AUTH_PRODUCT_NAME,
} from "@/modules/auth/presentation/copy";
import {
  AuthExperienceBand,
  AuthExperiencePanel,
  type AuthExperienceCopy,
} from "@/modules/auth/presentation/experience-panel";
import { AuthIdentity } from "@/modules/auth/presentation/surface";
import {
  FRIGORA_AUTH_EXPERIENCE,
  FRIGORA_AUTH_MARK,
  FRIGORA_PWA_NAME,
} from "@/modules/frigora/app/pwa/copy";
import { isFrigoraAuthContinuation } from "@/modules/frigora/app/pwa/paths";

const NEUTRAL_AUTH_EXPERIENCE: AuthExperienceCopy = {
  eyebrow: "",
  title: "",
  cadence: [],
  message: "",
};

function useFrigoraAuthContinuation() {
  const params = useSearchParams();
  return isFrigoraAuthContinuation(params.get("next") ?? "");
}

/** Suspense fallback: no VentureOS mark while continuation context resolves. */
export function NeutralAuthIdentity() {
  return <AuthIdentity name="" mark="" />;
}

export function NeutralAuthExperiencePanel() {
  return (
    <AuthExperiencePanel
      mark=""
      experience={NEUTRAL_AUTH_EXPERIENCE}
      ariaLabel="Loading sign in"
    />
  );
}

export function NeutralAuthExperienceBand() {
  return <AuthExperienceBand experience={NEUTRAL_AUTH_EXPERIENCE} />;
}

export function FrigoraAwareAuthIdentity() {
  const frigora = useFrigoraAuthContinuation();
  return frigora ? (
    <AuthIdentity name={FRIGORA_PWA_NAME} mark={FRIGORA_AUTH_MARK} />
  ) : (
    <AuthIdentity name={AUTH_PRODUCT_NAME} mark={AUTH_MARK} />
  );
}

export function FrigoraAwareAuthExperiencePanel() {
  const frigora = useFrigoraAuthContinuation();
  return frigora ? (
    <AuthExperiencePanel
      mark={FRIGORA_AUTH_MARK}
      experience={FRIGORA_AUTH_EXPERIENCE}
      ariaLabel="About Frigora"
    />
  ) : (
    <AuthExperiencePanel
      mark={AUTH_MARK}
      experience={AUTH_EXPERIENCE}
      ariaLabel="About VentureOS"
    />
  );
}

export function FrigoraAwareAuthExperienceBand() {
  const frigora = useFrigoraAuthContinuation();
  return frigora ? (
    <AuthExperienceBand experience={FRIGORA_AUTH_EXPERIENCE} />
  ) : (
    <AuthExperienceBand experience={AUTH_EXPERIENCE} />
  );
}
