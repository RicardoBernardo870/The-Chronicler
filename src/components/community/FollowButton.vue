<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import type { CommunityRelationshipState } from '@/types'

const props = defineProps<{
  relationship: CommunityRelationshipState | null
  loading?: boolean
}>()

const emit = defineEmits<{
  follow: []
  unfollow: []
}>()

const canRender = computed(() => props.relationship?.reason === 'allowed')
const isFollowing = computed(() => !!props.relationship?.isFollowing)
const label = computed(() => {
  if (isFollowing.value) return 'Following'
  return props.relationship?.followsViewer ? 'Follow back' : 'Follow'
})
const icon = computed(() => isFollowing.value ? 'pi pi-check' : 'pi pi-user-plus')

const onClick = () => {
  if (isFollowing.value) emit('unfollow')
  else emit('follow')
}
</script>

<template>
  <Button
    v-if="canRender"
    :label="label"
    :icon="icon"
    :outlined="isFollowing"
    :loading="loading"
    :disabled="loading"
    @click="onClick"
  />
</template>
