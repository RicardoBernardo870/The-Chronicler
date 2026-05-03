<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import MultiSelect from 'primevue/multiselect'
import { useCommunityGraphStore } from '@/stores/communityGraph'
import { useReadingCirclesStore } from '@/stores/readingCircles'
import type { CommunityReaderSearchResult } from '@/types'

const props = defineProps<{
  bookId: string
  circleId?: string | null
  mode: 'create' | 'invite'
}>()

const emit = defineEmits<{
  saved: [circleId: string]
}>()

const visible = defineModel<boolean>('visible', { required: true })

const graphStore = useCommunityGraphStore()
const circlesStore = useReadingCirclesStore()

const name = ref('')
const query = ref('')
const selectedUserIds = ref<string[]>([])
const options = ref<CommunityReaderSearchResult[]>([])
const loadingReaders = ref(false)
const localError = ref<string | null>(null)

const title = computed(() => props.mode === 'create' ? 'Create Reading Circle' : 'Invite readers')
const canSubmit = computed(() => {
  if (props.mode === 'create' && !name.value.trim()) return false
  return circlesStore.status !== 'saving'
})

const search = async () => {
  loadingReaders.value = true
  try {
    const page = await graphStore.searchReaders(query.value)
    options.value = page.items.filter(item => item.isFollowing)
  } finally {
    loadingReaders.value = false
  }
}

watch(
  () => visible.value,
  isVisible => {
    if (isVisible) void search()
    else {
      localError.value = null
      query.value = ''
      selectedUserIds.value = []
      if (props.mode === 'create') name.value = ''
    }
  },
)

watch(query, () => { void search() })

const optionLabel = (reader: CommunityReaderSearchResult) => (
  reader.displayName ? `${reader.displayName} (@${reader.username})` : `@${reader.username}`
)

const submit = async () => {
  localError.value = null
  try {
    if (props.mode === 'create') {
      const result = await circlesStore.createCircle(props.bookId, name.value, selectedUserIds.value)
      emit('saved', result.circleId)
    } else if (props.circleId) {
      const result = await circlesStore.inviteMembers(props.circleId, selectedUserIds.value)
      emit('saved', result.circleId)
    }
    visible.value = false
  } catch (err) {
    localError.value = err instanceof Error ? err.message : 'Unable to save Reading Circle'
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="title"
    modal
    class="reading-circle-invite-dialog"
    :style="{ width: 'min(92vw, 32rem)' }"
  >
    <form class="reading-circle-invite-dialog__form" @submit.prevent="submit">
      <label v-if="mode === 'create'" class="reading-circle-invite-dialog__field">
        <span>Name</span>
        <InputText v-model="name" maxlength="80" autofocus />
      </label>

      <label class="reading-circle-invite-dialog__field">
        <span>Followed readers</span>
        <InputText v-model="query" placeholder="Search readers you follow" />
      </label>

      <MultiSelect
        v-model="selectedUserIds"
        :options="options"
        option-value="userId"
        :option-label="optionLabel"
        :loading="loadingReaders"
        display="chip"
        filter
        placeholder="Choose readers"
      />

      <Message v-if="localError || circlesStore.error" severity="error" size="small">
        {{ localError || circlesStore.error }}
      </Message>

      <div class="reading-circle-invite-dialog__actions">
        <Button label="Cancel" text type="button" @click="visible = false" />
        <Button
          :label="mode === 'create' ? 'Create' : 'Invite'"
          icon="pi pi-send"
          type="submit"
          :disabled="!canSubmit"
          :loading="circlesStore.status === 'saving'"
        />
      </div>
    </form>
  </Dialog>
</template>

<style scoped>
.reading-circle-invite-dialog__form,
.reading-circle-invite-dialog__field {
  display: flex;
  flex-direction: column;
}

.reading-circle-invite-dialog__form {
  gap: 0.85rem;
}

.reading-circle-invite-dialog__field {
  gap: 0.35rem;
}

.reading-circle-invite-dialog__field span {
  color: var(--p-text-muted-color);
  font-size: 0.82rem;
}

.reading-circle-invite-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
