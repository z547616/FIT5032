<template>
  <!-- Overlay -->
  <div class="ec-overlay" @click.self="handleClose">
    <!-- Drawer -->
    <div class="ec-drawer card shadow-lg">
      <div class="card-header d-flex align-items-center justify-content-between">
        <h5 class="mb-0">Compose Email</h5>
        <button class="btn btn-sm btn-outline-secondary" @click="handleClose">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>

      <div class="card-body">
        <!-- Recipients -->
        <div class="mb-3">
          <label class="form-label fw-semibold">Recipients</label>
          <div class="d-flex flex-wrap gap-2">
            <span
              v-for="(r, i) in recipients"
              :key="(r.email || '') + i"
              class="badge rounded-pill text-bg-secondary"
              title="Recipient"
            >
              {{ displayRecipient(r) }}
            </span>
          </div>
          <div class="form-text">{{ recipients.length }} recipient(s)</div>
        </div>

        <!-- Subject -->
        <div class="mb-3">
          <label class="form-label fw-semibold">Subject</label>
          <input
            v-model.trim="form.subject"
            type="text"
            class="form-control"
            placeholder="Subject"
            maxlength="180"
          />
        </div>

        <!-- Text -->
        <div class="mb-3">
          <label class="form-label fw-semibold">Text (Plain)</label>
          <textarea
            v-model.trim="form.text"
            class="form-control"
            rows="4"
            placeholder="Email plain text content"
          ></textarea>
          <div class="form-text">
            Provide either <strong>Text</strong> or <strong>HTML</strong>.
          </div>
        </div>

        <!-- HTML -->
        <div class="mb-3">
          <label class="form-label fw-semibold">HTML (Optional)</label>
          <textarea
            v-model.trim="form.html"
            class="form-control"
            rows="4"
            placeholder="HTML content (optional)"
          ></textarea>
        </div>

        <!-- Attachments -->
        <div class="mb-3">
          <label class="form-label fw-semibold">Attachments (Optional)</label>
          <input
            ref="fileInput"
            type="file"
            class="form-control"
            multiple
            @change="onPickFiles"
          />
          <ul class="list-unstyled mt-2 small" v-if="form.attachments.length">
            <li
              v-for="(a, i) in form.attachments"
              :key="a.name + i"
              class="d-flex justify-content-between align-items-center border rounded p-2 mb-2"
            >
              <div class="text-truncate pe-2">
                <i class="bi bi-paperclip me-2"></i>
                <strong>{{ a.name }}</strong>
                <span class="text-muted">({{ a.mimeType || 'application/octet-stream' }})</span>
              </div>
              <button
                class="btn btn-sm btn-outline-danger"
                title="Remove attachment"
                @click="removeAttachment(i)"
              >
                <i class="bi bi-x-lg"></i>
              </button>
            </li>
          </ul>
        </div>

        <!-- Alerts -->
        <div v-if="err" class="alert alert-danger py-2">{{ err }}</div>
        <div v-if="okMsg" class="alert alert-success py-2">{{ okMsg }}</div>
      </div>

      <div class="card-footer d-flex justify-content-end gap-2">
        <button class="btn btn-outline-secondary" :disabled="sending" @click="confirmClose">
          Close
        </button>
        <button class="btn btn-primary" :disabled="!canSend || sending" @click="sendEmail">
          <span v-if="sending" class="spinner-border spinner-border-sm me-2"></span>
          {{ sending ? 'Sending...' : 'Send' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { db } from '../../firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

/** Props & Emits */
const props = defineProps({
  recipients: { type: Array, default: () => [] }
})
const emit = defineEmits(['close', 'sent'])

/* ---------- State ---------- */
const form = ref({
  subject: '',
  text: '',
  html: '',
  attachments: []
})

const sending = ref(false)
const err = ref('')
const okMsg = ref('')
const fileInput = ref(null)

/* ---------- Helpers ---------- */
function displayRecipient (r) {
  if (!r) return 'Unknown'
  if (r.name && String(r.name).trim()) return r.name
  if (r.username && String(r.username).trim()) return r.username
  if (r.email && String(r.email).trim()) return r.email
  return 'Unknown'
}

const canSend = computed(() => {
  const hasRecipients = Array.isArray(props.recipients) && props.recipients.length > 0
  const hasSubject = !!form.value.subject.trim()
  const hasBody = !!form.value.text.trim() || !!form.value.html.trim()
  return hasRecipients && hasSubject && hasBody
})

function handleClose () { emit('close') }
function confirmClose () {
  if (form.value.subject || form.value.text || form.value.html || form.value.attachments.length) {
    if (!window.confirm('Close without sending? Your inputs will be discarded.')) return
  }
  handleClose()
}

function removeAttachment (i) {
  if (i >= 0 && i < form.value.attachments.length) form.value.attachments.splice(i, 1)
}

async function onPickFiles (e) {
  const files = Array.from(e.target.files || [])
  if (!files.length) return
  err.value = ''
  try {
    const converted = await Promise.all(files.map(fileToAttachment))
    form.value.attachments.push(...converted)
  } catch (ex) {
    console.error('[EmailComposer] file convert error', ex)
    err.value = 'Failed to read attachments.'
  } finally {
    if (fileInput.value) fileInput.value.value = ''
  }
}

function readAsDataURL (file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result)
    fr.onerror = reject
    fr.readAsDataURL(file)
  })
}

async function fileToAttachment (file) {
  const dataUrl = await readAsDataURL(file)
  const base64 = String(dataUrl).split(',')[1] || ''
  return { name: file.name, mimeType: file.type || 'application/octet-stream', contentBase64: base64 }
}

/* ---------- Send Email ---------- */
async function sendEmail () {
  if (!canSend.value || sending.value) return
  sending.value = true
  err.value = ''
  okMsg.value = ''

  try {
    // 当前管理员信息
    const auth = getAuth()
    const user = auth.currentUser
    const byUid = user?.uid || null
    const byEmail = user?.email || ''

    // 收件人整理
    const recipients = props.recipients
      .map((r) => ({
        email: String(r?.email || '').trim(),
        name: String(r?.name || r?.username || '').trim()
      }))
      .filter((r) => r.email)

    if (!recipients.length) {
      err.value = 'No valid recipient emails.'
      sending.value = false
      return
    }

    console.log('[EmailComposer] queue job recipients:', recipients)

    // ✅ 只写 createdBy(uid) + createdByEmail(供展示)
    const ref = await addDoc(collection(db, 'mail_jobs'), {
      status: 'queued',
      createdAt: serverTimestamp(),
      subject: form.value.subject.trim(),
      text: form.value.text.trim(),
      html: form.value.html.trim(),
      recipients,
      attachments: form.value.attachments,
      createdBy: byUid,
      createdByEmail: byEmail
    })

    console.log('[EmailComposer] job created:', ref.id)
    okMsg.value = 'Queued successfully. Emails will be sent shortly.'
    setTimeout(() => {
      emit('sent')
      handleClose()
    }, 600)
  } catch (e) {
    console.error('[EmailComposer] create mail job failed', e)
    err.value = e?.message || 'Failed to queue email job.'
  } finally {
    sending.value = false
  }
}
</script>

<style scoped>
.ec-overlay {
  position: fixed;
  inset: 0;
  z-index: 4000;
  background: rgba(0, 0, 0, 0.35);
  display: grid;
  place-items: center;
  padding: 16px;
}

/* Drawer panel */
.ec-drawer {
  width: min(760px, 95vw);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}
.ec-drawer .card-body {
  overflow: auto;
}
</style>
