<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useLibraryImport } from '@/composables/useLibraryImport'
import Dialog from 'primevue/dialog'
import FileUpload, { type FileUploadSelectEvent } from 'primevue/fileupload'
import ProgressBar from 'primevue/progressbar'
import Message from 'primevue/message'
import Button from 'primevue/button'
import ImportSummaryPanel from '@/components/import/ImportSummaryPanel.vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  done: []
}>()

const router = useRouter()
const { phase, processed, total, summary, errorMessage, startImport, reset } = useLibraryImport()

const busy = computed(() => ['parsing', 'importing', 'enriching'].includes(phase.value))

const phaseLabel = computed(() => {
  switch (phase.value) {
    case 'parsing': return 'Reading your file…'
    case 'importing': return 'Adding books to your library…'
    case 'enriching': return `Filling in covers & details… ${processed.value} of ${total.value}`
    default: return ''
  }
})

const progressValue = computed(() =>
  total.value > 0 ? Math.round((processed.value / total.value) * 100) : 0,
)

const onSelect = (event: FileUploadSelectEvent): void => {
  const file = Array.isArray(event.files) ? event.files[0] : event.files
  if (file) void startImport(file as File)
}

const close = (): void => {
  if (busy.value) return
  emit('update:visible', false)
}

const onHide = (): void => {
  reset()
}

const goToLibrary = (): void => {
  emit('update:visible', false)
  router.push('/library')
}

watch(phase, (p) => {
  if (p === 'done') emit('done')
})
</script>

<template>
  <Dialog
    :visible="props.visible"
    modal
    header="Import your library"
    :closable="!busy"
    :style="{ width: '92vw', maxWidth: '460px' }"
    @update:visible="(v) => (v ? null : close())"
    @hide="onHide"
  >
    <!-- Idle: choose a file -->
    <template v-if="phase === 'idle'">
      <p class="import-dialog__intro">
        Upload your <strong>Goodreads</strong> or <strong>StoryGraph</strong> CSV export. We'll
        add your books, match their shelves, and fill in covers in the background.
      </p>
      <FileUpload
        mode="basic"
        accept=".csv,text/csv"
        :auto="false"
        custom-upload
        choose-label="Choose CSV file"
        choose-icon="pi pi-file-import"
        @select="onSelect"
      />
      <p class="import-dialog__hint">
        Read books become finished; to-read and currently-reading land in your Want-to-read shelf.
      </p>
    </template>

    <!-- Working -->
    <template v-else-if="busy">
      <p class="import-dialog__status">{{ phaseLabel }}</p>
      <ProgressBar
        v-if="phase === 'enriching' && total > 0"
        :value="progressValue"
      />
      <ProgressBar v-else mode="indeterminate" style="height: 0.5rem" />
    </template>

    <!-- Error -->
    <template v-else-if="phase === 'error'">
      <Message severity="error" :closable="false">{{ errorMessage }}</Message>
    </template>

    <!-- Done -->
    <ImportSummaryPanel v-else-if="phase === 'done' && summary" :summary="summary" />

    <template #footer>
      <Button
        v-if="phase === 'error'"
        label="Try another file"
        text
        @click="reset"
      />
      <Button
        v-if="phase === 'done'"
        label="View library"
        icon="pi pi-book"
        @click="goToLibrary"
      />
      <Button
        v-if="!busy"
        :label="phase === 'done' ? 'Close' : 'Cancel'"
        :text="phase !== 'idle'"
        @click="close"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.import-dialog__intro {
  margin: 0 0 1rem;
  font-size: 0.88rem;
  line-height: 1.5;
}

.import-dialog__hint {
  margin: 0.85rem 0 0;
  font-size: 0.78rem;
  opacity: 0.6;
  line-height: 1.45;
}

.import-dialog__status {
  margin: 0 0 0.85rem;
  font-size: 0.88rem;
  font-weight: 600;
}
</style>
