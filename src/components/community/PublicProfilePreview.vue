<script setup lang="ts">
import { computed } from "vue";
import Button from "primevue/button";
import Message from "primevue/message";
import type {
  CommunityProfileIdentity,
  CommunityProfilePrivacy,
} from "@/types";
import { useRouter } from "vue-router";

const props = defineProps<{
  profile: {
    profile: CommunityProfileIdentity & { isPublic: boolean };
    privacy: CommunityProfilePrivacy;
  };
  mode?: "owner" | "viewer";
  editable?: boolean;
}>();

defineEmits<{
  edit: [];
}>();

const mode = computed(() => props.mode ?? "viewer");
const canSee = (visibility: "everyone" | "followers" | "nobody") =>
  mode.value === "owner" || visibility === "everyone";
const router = useRouter();

const sections = computed(() => {
  if (mode.value === "viewer" && !props.profile.profile.isPublic) return [];
  return [
    canSee(props.profile.privacy.readerDna) && "Reader DNA",
    canSee(props.profile.privacy.currentlyReading) && "Currently reading",
    canSee(props.profile.privacy.progress) && "Progress stats",
    canSee(props.profile.privacy.lexicon) && "Recently mastered words",
  ].filter(Boolean) as string[];
});
</script>

<template>
  <section class="profile-preview glass-subtle">
    <header class="profile-preview__header">
      <div class="profile-preview__avatar">
        <img
          v-if="profile.profile.avatarUrl"
          :src="profile.profile.avatarUrl"
          :alt="profile.profile.displayName ?? profile.profile.username"
        />
        <span v-else>{{
          (profile.profile.username || "?").slice(0, 1).toUpperCase()
        }}</span>
      </div>
      <div class="profile-preview__identity">
        <h3>
          {{
            profile.profile.displayName ||
            profile.profile.username ||
            "Your reader name"
          }}
        </h3>
        <p>@{{ profile.profile.username || "username" }}</p>
      </div>
      <Button
        v-if="editable"
        icon="pi pi-pencil"
        text
        rounded
        aria-label="Edit community profile"
        class="profile-preview__edit"
        @click="$emit('edit')"
      />
    </header>

    <p v-if="profile.profile.bio" class="profile-preview__bio">
      {{ profile.profile.bio }}
    </p>

    <Message
      v-if="mode === 'viewer' && !profile.profile.isPublic"
      severity="info"
      class="profile-preview__message"
    >
      Public viewers see the generic unavailable state.
    </Message>

    <div v-else class="profile-preview__sections">
      <span
        v-for="section in sections"
        :key="section"
        class="profile-preview__pill"
      >
        {{ section }}
      </span>
      <Message
        v-if="sections.length === 0"
        severity="info"
        class="profile-preview__message"
      >
        No public sections are visible in this preview.
      </Message>
    </div>

    <Button
      type="button"
      label="View Profile"
      icon="pi pi-user"
      text
      :disabled="!profile.profile.username"
      @click="
        router.push({
          name: 'public-profile',
          params: { username: profile.profile.username },
        })
      "
    />
  </section>
</template>

<style scoped>
.profile-preview {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.profile-preview__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.profile-preview__avatar {
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--surface-border);
  background: var(--surface-card);
  font-weight: 800;
}

.profile-preview__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-preview__identity {
  min-width: 0;
  flex: 1 1 auto;
}

.profile-preview__identity h3,
.profile-preview__identity p,
.profile-preview__bio {
  margin: 0;
  overflow-wrap: anywhere;
}

.profile-preview__identity h3 {
  font-size: 1rem;
}

.profile-preview__identity p {
  margin-top: 0.1rem;
  font-size: 0.82rem;
  opacity: 0.65;
}

.profile-preview__bio {
  line-height: 1.45;
  font-size: 0.9rem;
}

.profile-preview__sections {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.profile-preview__pill {
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  font-size: 0.78rem;
  font-weight: 700;
}

.profile-preview__message {
  margin: 0;
}

.profile-preview__edit {
  flex: 0 0 auto;
}
</style>
