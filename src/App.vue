<script setup>
import { reactive, ref, onMounted } from 'vue'

const mood = ref('')
const notes = ref('')
const entries = reactive([])

const moodError = ref('')
const notesError = ref('')

onMounted(() => {
  const saved = JSON.parse(localStorage.getItem('moodEntries') || '[]')
  entries.push(...saved)
})

function submitForm() {
  moodError.value = ''
  notesError.value = ''

  // Validation: mood required and between 0–10
  if (mood.value === '' || mood.value < 0 || mood.value > 10) {
    moodError.value = 'Please enter a mood between 0 and 10.'
    return
  }
  // Validation: notes length <= 100
  if (notes.value.length > 100) {
    notesError.value = 'Notes must be less than 100 characters.'
    return
  }

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

<template>
  <div class="container my-4">
    <h1 class="text-center mb-4">Youth Mental Health - Mood Tracker</h1>

    <div class="row">
      <!-- Left: Form -->
      <div class="col-md-6 mb-4">
        <div class="card p-3">
          <h4>Log Today's Mood</h4>
          <form @submit.prevent="submitForm">
            <div class="mb-3">
              <label class="form-label">Mood (0-10)</label>
              <input v-model.number="mood" type="number" class="form-control" min="0" max="10" required>
              <div v-if="moodError" class="text-danger mt-1">{{ moodError }}</div>
            </div>

            <div class="mb-3">
              <label class="form-label">Notes</label>
              <textarea v-model="notes" class="form-control" rows="3" maxlength="100"></textarea>
              <div v-if="notesError" class="text-danger mt-1">{{ notesError }}</div>
            </div>

            <button type="submit" class="btn btn-primary">Save Entry</button>
          </form>
        </div>
      </div>

      <!-- Right: History -->
      <div class="col-md-6">
        <div class="card p-3">
          <h4>History</h4>
          <div v-if="entries.length === 0" class="text-muted">No entries yet.</div>
          <ul class="list-group">
            <li v-for="(e,i) in entries" :key="i" class="list-group-item">
              <strong>{{ e.date }}</strong> - Mood: {{ e.mood }} / 10 <br>
              {{ e.notes }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
