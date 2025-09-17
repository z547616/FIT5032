<template>
  <div class="bg-light min-vh-100 py-5">
    <div class="container">
      <h1 class="text-center display-5 fw-bold text-primary mb-5">
        Mood Tracker
      </h1>

      <div class="row g-4">
        <!-- Form -->
        <div class="col-md-6">
          <div class="card border-0 shadow-sm rounded-4">
            <div class="card-body p-4">
              <h4 class="mb-4">Log Today's Mood</h4>
              <form @submit.prevent="submitForm">
                <div class="mb-3">
                  <label class="form-label fw-semibold">Mood (0-10)</label>
                  <input v-model.number="mood" type="number" class="form-control rounded-3" min="0" max="10" required>
                </div>

                <div class="mb-3">
                  <label class="form-label fw-semibold">Notes</label>
                  <textarea v-model="notes" class="form-control rounded-3" rows="3" maxlength="100"
                    placeholder="How are you feeling today?"></textarea>
                </div>

                <button type="submit" class="btn btn-primary w-100 rounded-3">
                  Save Entry
                </button>
              </form>
            </div>
          </div>
        </div>

        <!-- History -->
        <div class="col-md-6">
          <div class="card border-0 shadow-sm rounded-4">
            <div class="card-body p-4">
              <h4 class="mb-4">History</h4>
              <div v-if="entries.length === 0" class="text-muted">No entries yet.</div>
              <ul class="list-group list-group-flush">
                <li v-for="(e,i) in entries" :key="i" class="list-group-item px-0 py-2">
                  <div class="fw-semibold">{{ e.date }} — Mood: {{ e.mood }}/10</div>
                  <div class="small text-muted">{{ e.notes }}</div>
                </li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'

const mood = ref('')
const notes = ref('')
const entries = reactive([])

onMounted(() => {
  const saved = JSON.parse(localStorage.getItem('moodEntries') || '[]')
  entries.push(...saved)
})

function submitForm() {
  const entry = {
    date: new Date().toLocaleDateString(),
    mood: mood.value,
    notes: notes.value
  }
  entries.unshift(entry)
  localStorage.setItem('moodEntries', JSON.stringify(entries))
  mood.value = ''
  notes.value = ''
}
</script>
