import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { supabase } from './lib/supabase'

function App() {
  const [campers, setCampers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [activeSession, setActiveSession] = useState(null)
  const [sessions, setSessions] = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [editingRegistrationId, setEditingRegistrationId] = useState(null)
  const [editingCamperId, setEditingCamperId] = useState(null)
  const [editingGuardianId, setEditingGuardianId] = useState(null)
  const [editingEmergencyId, setEditingEmergencyId] = useState(null)
  const [session, setSession] = useState(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(true)

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    age: '',
    grade: '',
    tshirt_size: '',
    medical_notes: '',
    allergies: '',
    guardian_first_name: '',
    guardian_last_name: '',
    guardian_relationship: 'Parent',
    guardian_email: '',
    guardian_phone: '',
    emergency_name: '',
    emergency_relationship: '',
    emergency_phone: '',
    liability_waiver: false,
    photo_release: false,
  })

  function exportRosterCsv() {
    const rows = filteredCampers.map((c) => {
      const primaryGuardian =
        c.guardians?.find((g) => g.is_primary) || c.guardians?.[0] || null
      const emergency = c.emergency_contacts?.[0] || null

      return {
        session: sessions.find((s) => s.id === selectedSessionId)?.name || activeSession?.name || '',
        camper_first_name: c.campers?.first_name || '',
        camper_last_name: c.campers?.last_name || '',
        age: c.campers?.age ?? '',
        grade: c.campers?.grade || '',
        tshirt_size: c.campers?.tshirt_size || '',
        guardian_first_name: primaryGuardian?.first_name || '',
        guardian_last_name: primaryGuardian?.last_name || '',
        guardian_relationship: primaryGuardian?.relationship || '',
        guardian_email: primaryGuardian?.email || '',
        guardian_phone: primaryGuardian?.phone || '',
        emergency_name: emergency?.name || '',
        emergency_relationship: emergency?.relationship || '',
        emergency_phone: emergency?.phone || '',
        liability_waiver: c.liability_waiver ? 'Yes' : 'No',
        photo_release: c.photo_release ? 'Yes' : 'No',
        attendance_status: c.attendance_status || '',
        medical_notes: c.medical_notes || '',
        allergies: c.allergies || '',
      }
    })

    if (rows.length === 0) {
      alert('No roster data to export for this session')
      return
    }

    const headers = Object.keys(rows[0])

    const escapeCsvValue = (value) => {
      const stringValue = String(value ?? '')
      if (
        stringValue.includes(',') ||
        stringValue.includes('"') ||
        stringValue.includes('\n')
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    }

    const csvLines = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((header) => escapeCsvValue(row[header])).join(',')
      ),
    ]

    const csvContent = csvLines.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    const sessionName =
      sessions.find((s) => s.id === selectedSessionId)?.name ||
      activeSession?.name ||
      'session'

    const safeSessionName = sessionName.replace(/[^a-z0-9]+/gi, '_').toLowerCase()

    link.href = url
    link.setAttribute('download', `${safeSessionName}_roster.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
  function getFilteredGuardianEmails() {
    const emails = filteredCampers
      .flatMap((c) =>
        (c.guardians || [])
          .map((g) => (g.email || '').trim().toLowerCase())
          .filter(Boolean)
      )

    return [...new Set(emails)].sort()
  }

  function exportEmailsCsv() {
    const emails = getFilteredGuardianEmails()

    if (emails.length === 0) {
      alert('No guardian email addresses found for this session/filter')
      return
    }

    const csvLines = ['email', ...emails]
    const csvContent = csvLines.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    const sessionName =
      sessions.find((s) => s.id === selectedSessionId)?.name ||
      activeSession?.name ||
      'session'

    const safeSessionName = sessionName.replace(/[^a-z0-9]+/gi, '_').toLowerCase()

    link.href = url
    link.setAttribute('download', `${safeSessionName}_guardian_emails.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  async function copyEmailsToClipboard() {
    const emails = getFilteredGuardianEmails()

    if (emails.length === 0) {
      alert('No guardian email addresses found for this session/filter')
      return
    }

    const emailList = emails.join(', ')

    try {
      await navigator.clipboard.writeText(emailList)
      alert(`Copied ${emails.length} email address(es) to clipboard`)
    } catch (error) {
      console.error(error)
      alert('Could not copy emails to clipboard')
    }
  }

  async function loadCampers(sessionIdOverride = null) {
    if (!session) return
    setLoading(true)

    const { data: sessionsData, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .order('start_date', { ascending: true })

    if (sessionsError) {
      console.error(sessionsError)
      alert('Error loading sessions')
      setLoading(false)
      return
    }

    setSessions(sessionsData || [])

    const currentActiveSession =
      sessionsData?.find((s) => s.is_active) || sessionsData?.[0] || null

    if (!currentActiveSession) {
      setActiveSession(null)
      setCampers([])
      setLoading(false)
      return
    }

    setActiveSession(currentActiveSession)

    const rosterSessionId =
      sessionIdOverride || selectedSessionId || currentActiveSession.id

    if (!selectedSessionId) {
      setSelectedSessionId(rosterSessionId)
    }

    const { data, error } = await supabase
      .from('registrations')
      .select(`
      *,
      campers (
        *
      )
    `)
      .eq('session_id', rosterSessionId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      alert('Error loading registrations')
      setLoading(false)
      return
    }

    const camperIds = (data || []).map((r) => r.camper_id)

    let guardiansByCamper = {}
    let emergencyByCamper = {}

    if (camperIds.length > 0) {
      const { data: guardianData } = await supabase
        .from('guardians')
        .select('*')
        .in('camper_id', camperIds)

      const { data: emergencyData } = await supabase
        .from('emergency_contacts')
        .select('*')
        .in('camper_id', camperIds)

      guardiansByCamper = (guardianData || []).reduce((acc, g) => {
        if (!acc[g.camper_id]) acc[g.camper_id] = []
        acc[g.camper_id].push(g)
        return acc
      }, {})

      emergencyByCamper = (emergencyData || []).reduce((acc, e) => {
        if (!acc[e.camper_id]) acc[e.camper_id] = []
        acc[e.camper_id].push(e)
        return acc
      }, {})
    }

    const merged = (data || []).map((r) => ({
      ...r,
      guardians: guardiansByCamper[r.camper_id] || [],
      emergency_contacts: emergencyByCamper[r.camper_id] || [],
    }))

    setCampers(merged)
    setLoading(false)
  }

  useEffect(() => {
    if (session) {
      loadCampers()
    }
  }, [session])

  useEffect(() => {
    if (session && selectedSessionId) {
      loadCampers(selectedSessionId)
    }
  }, [session, selectedSessionId])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function resetForm() {
    setForm({
      first_name: '',
      last_name: '',
      age: '',
      grade: '',
      tshirt_size: '',
      medical_notes: '',
      allergies: '',
      guardian_first_name: '',
      guardian_last_name: '',
      guardian_relationship: 'Parent',
      guardian_email: '',
      guardian_phone: '',
      emergency_name: '',
      emergency_relationship: '',
      emergency_phone: '',
      liability_waiver: false,
      photo_release: false,
    })

    setEditingRegistrationId(null)
    setEditingCamperId(null)
    setEditingGuardianId(null)
    setEditingEmergencyId(null)
  }
  function startEdit(registration) {
    if (!registration?.campers) return

    const primaryGuardian =
      registration.guardians?.find((g) => g.is_primary) ||
      registration.guardians?.[0] ||
      null

    const emergency = registration.emergency_contacts?.[0] || null

    setForm({
      first_name: registration.campers.first_name || '',
      last_name: registration.campers.last_name || '',
      age: registration.campers.age ?? '',
      grade: registration.campers.grade || '',
      tshirt_size: registration.campers.tshirt_size || '',
      medical_notes: registration.medical_notes || '',
      allergies: registration.allergies || '',
      guardian_first_name: primaryGuardian?.first_name || '',
      guardian_last_name: primaryGuardian?.last_name || '',
      guardian_relationship: primaryGuardian?.relationship || 'Parent',
      guardian_email: primaryGuardian?.email || '',
      guardian_phone: primaryGuardian?.phone || '',
      emergency_name: emergency?.name || '',
      emergency_relationship: emergency?.relationship || '',
      emergency_phone: emergency?.phone || '',
      liability_waiver: !!registration.liability_waiver,
      photo_release: !!registration.photo_release,
    })

    setEditingRegistrationId(registration.id)
    setEditingCamperId(registration.camper_id)
    setEditingGuardianId(primaryGuardian?.id || null)
    setEditingEmergencyId(emergency?.id || null)
  }

  async function addCamper(e) {
    e.preventDefault()
    setSaving(true)

    try {
      if (!activeSession) {
        throw new Error('No active session found')
      }

      if (editingRegistrationId) {
        if (!editingCamperId) {
          throw new Error('Missing camper ID for edit')
        }

        const camperPayload = {
          first_name: form.first_name,
          last_name: form.last_name,
          age: form.age ? Number(form.age) : null,
          grade: form.grade || null,
          tshirt_size: form.tshirt_size || null,
        }

        const { data: updatedCamper, error: camperError } = await supabase
          .from('campers')
          .update(camperPayload)
          .eq('id', editingCamperId)
          .select()

        if (camperError) throw camperError
        if (!updatedCamper || updatedCamper.length === 0) {
          throw new Error('Camper update matched no rows')
        }

        const registrationPayload = {
          session_id: selectedSessionId || activeSession.id,
          liability_waiver: form.liability_waiver || false,
          photo_release: form.photo_release || false,
          medical_notes: form.medical_notes || null,
          allergies: form.allergies || null,
        }

        const { data: updatedRegistration, error: registrationError } = await supabase
          .from('registrations')
          .update(registrationPayload)
          .eq('id', editingRegistrationId)
          .select()

        if (registrationError) throw registrationError
        if (!updatedRegistration || updatedRegistration.length === 0) {
          throw new Error('Registration update matched no rows')
        }

        const guardianPayload = {
          first_name: form.guardian_first_name,
          last_name: form.guardian_last_name,
          relationship: form.guardian_relationship || null,
          email: form.guardian_email || null,
          phone: form.guardian_phone || null,
        }

        if (editingGuardianId) {
          const { data: updatedGuardian, error: guardianError } = await supabase
            .from('guardians')
            .update(guardianPayload)
            .eq('id', editingGuardianId)
            .select()

          if (guardianError) throw guardianError
          if (!updatedGuardian || updatedGuardian.length === 0) {
            throw new Error('Guardian update matched no rows')
          }
        } else {
          const { data: insertedGuardian, error: guardianInsertError } = await supabase
            .from('guardians')
            .insert([{
              camper_id: editingCamperId,
              ...guardianPayload,
              is_primary: true,
            }])
            .select()

          if (guardianInsertError) throw guardianInsertError
          if (!insertedGuardian || insertedGuardian.length === 0) {
            throw new Error('Guardian insert failed')
          }
        }

        const emergencyName = form.emergency_name?.trim() || ''
        const emergencyRelationship = form.emergency_relationship?.trim() || ''
        const emergencyPhone = form.emergency_phone?.trim() || ''
        const hasAnyEmergencyInfo =
          emergencyName || emergencyRelationship || emergencyPhone

        if (hasAnyEmergencyInfo && (!emergencyName || !emergencyPhone)) {
          throw new Error('Emergency contact requires at least a name and phone number')
        }


        if (emergencyName && emergencyPhone) {
          const emergencyPayload = {
            camper_id: editingCamperId,
            name: emergencyName,
            relationship: emergencyRelationship || null,
            phone: emergencyPhone,
          }

          if (editingEmergencyId) {
            const { data: updatedEmergency, error: emergencyError } = await supabase
              .from('emergency_contacts')
              .update(emergencyPayload)
              .eq('id', editingEmergencyId)
              .select()

            if (emergencyError) throw emergencyError
            if (!updatedEmergency || updatedEmergency.length === 0) {
              throw new Error('Emergency contact update matched no rows')
            }
          } else {
            const { data: insertedEmergency, error: emergencyInsertError } = await supabase
              .from('emergency_contacts')
              .insert([emergencyPayload])
              .select()

            if (emergencyInsertError) throw emergencyInsertError
            if (!insertedEmergency || insertedEmergency.length === 0) {
              throw new Error('Emergency contact insert failed')
            }

            setEditingEmergencyId(insertedEmergency[0].id)
          }
        } else if (editingEmergencyId && !emergencyName && !emergencyPhone) {
          const { error: deleteEmergencyError } = await supabase
            .from('emergency_contacts')
            .delete()
            .eq('id', editingEmergencyId)

          if (deleteEmergencyError) throw deleteEmergencyError
        }

        await loadCampers(selectedSessionId)
        resetForm()
        return
      }

      const camperPayload = {
        first_name: form.first_name,
        last_name: form.last_name,
        age: form.age ? Number(form.age) : null,
        grade: form.grade || null,
        tshirt_size: form.tshirt_size || null,
      }

      const { data: camperInsert, error: camperError } = await supabase
        .from('campers')
        .insert([camperPayload])
        .select()
        .single()

      if (camperError) throw camperError
      if (!camperInsert?.id) throw new Error('Camper record was not returned after insert')

      const camperId = camperInsert.id

      const registrationPayload = {
        camper_id: camperId,
        session_id: selectedSessionId || activeSession.id,
        attendance_status: 'not_checked_in',
        liability_waiver: form.liability_waiver || false,
        photo_release: form.photo_release || false,
        medical_notes: form.medical_notes || null,
        allergies: form.allergies || null,
        pickup_notes: null,
      }

      const { error: registrationError } = await supabase
        .from('registrations')
        .insert([registrationPayload])

      if (registrationError) throw registrationError

      const guardianPayload = {
        camper_id: camperId,
        first_name: form.guardian_first_name,
        last_name: form.guardian_last_name,
        relationship: form.guardian_relationship || null,
        email: form.guardian_email || null,
        phone: form.guardian_phone || null,
        is_primary: true,
      }

      const { error: guardianError } = await supabase
        .from('guardians')
        .insert([guardianPayload])

      if (guardianError) throw guardianError

      const emergencyName = form.emergency_name?.trim() || ''
      const emergencyRelationship = form.emergency_relationship?.trim() || ''
      const emergencyPhone = form.emergency_phone?.trim() || ''
      const hasAnyEmergencyInfo =
        emergencyName || emergencyRelationship || emergencyPhone

      if (hasAnyEmergencyInfo && (!emergencyName || !emergencyPhone)) {
        throw new Error('Emergency contact requires at least a name and phone number')
      }

      if (emergencyName && emergencyPhone) {
        const emergencyPayload = {
          camper_id: camperId,
          name: emergencyName,
          relationship: emergencyRelationship || null,
          phone: emergencyPhone,
        }

        const { data: insertedEmergency, error: emergencyError } = await supabase
          .from('emergency_contacts')
          .insert([emergencyPayload])
          .select()

        if (emergencyError) throw emergencyError
        if (!insertedEmergency || insertedEmergency.length === 0) {
          throw new Error('Emergency contact insert failed')
        }
      }

      resetForm()
      await loadCampers(selectedSessionId)
    } catch (error) {
      console.error(error)
      alert(`Error saving registration: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function toggleCheckIn(id, currentStatus) {
    const newStatus =
      currentStatus === 'checked_in' ? 'not_checked_in' : 'checked_in'

    const { error } = await supabase
      .from('registrations')
      .update({ attendance_status: newStatus })
      .eq('id', id)

    if (error) {
      console.error(error)
      alert('Error updating check-in')
    } else {
      loadCampers()
    }
  }

  async function toggleWaiver(id, currentValue) {
    const { error } = await supabase
      .from('registrations')
      .update({ liability_waiver: !currentValue })
      .eq('id', id)

    if (error) {
      console.error(error)
      alert('Error updating waiver status')
    } else {
      loadCampers()
    }
  }

  async function togglePhotoRelease(id, currentValue) {
    const { error } = await supabase
      .from('registrations')
      .update({ photo_release: !currentValue })
      .eq('id', id)

    if (error) {
      console.error(error)
      alert('Error updating photo release')
    } else {
      loadCampers()
    }
  }

  async function deleteRegistration(id) {
    if (!window.confirm('Delete this registration?')) return

    const { error } = await supabase
      .from('registrations')
      .delete()
      .eq('id', id)

    if (error) {
      console.error(error)
      alert('Error deleting registration')
    } else {
      loadCampers()
    }
  }

  async function handleSignIn(e) {
    e.preventDefault()

    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    })

    if (error) {
      alert(error.message)
    }
  }

  async function handleSignUp(e) {
    e.preventDefault()

    const { error } = await supabase.auth.signUp({
      email: authEmail,
      password: authPassword,
    })

    if (error) {
      alert(error.message)
    } else {
      alert('Account created. You can now sign in.')
    }
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      alert(error.message)
    }
  }

  const filteredCampers = campers.filter((c) =>
    `${c.campers?.first_name ?? ''} ${c.campers?.last_name ?? ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  if (authLoading) {
    return <div style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>Loading...</div>
  }

  if (!session) {
    return (
      <div style={{ maxWidth: 420, margin: '60px auto', padding: 24, border: '1px solid #ddd', borderRadius: 12, fontFamily: 'Arial, sans-serif' }}>
        <h1>Young Eagles Workshop Login</h1>
        <form onSubmit={handleSignIn} style={{ display: 'grid', gap: 12 }}>
          <input
            type="email"
            placeholder="Email"
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            required
          />
          <button type="submit">Sign In</button>
          <button type="button" onClick={handleSignUp}>
            Create Admin Account
          </button>
        </form>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button type="button" onClick={handleSignOut}>
          Sign Out
        </button>
      </div>
      <h1>Young Eagles Workshop Registration</h1>
      <p>
        Viewing Session:{' '}
        {sessions.find((s) => s.id === selectedSessionId)?.name ||
          activeSession?.name ||
          'Loading...'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 24, alignItems: 'start' }}>
        <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
          <h2>Add Camper Registration</h2>
          {editingRegistrationId && (
            <p style={{ color: '#b45309', fontWeight: 'bold' }}>
              Editing existing registration
            </p>
          )}
          <h3 style={{ marginBottom: 0 }}>Session</h3>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            style={{ padding: 8 }}
          >
            <option value="">Select a session</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.name}
              </option>
            ))}
          </select>

          <form onSubmit={addCamper} style={{ display: 'grid', gap: 10 }}>
            <h3 style={{ marginBottom: 0 }}>Camper</h3>
            <input
              placeholder="Camper first name"
              value={form.first_name}
              onChange={(e) => updateField('first_name', e.target.value)}
              required
            />
            <input
              placeholder="Camper last name"
              value={form.last_name}
              onChange={(e) => updateField('last_name', e.target.value)}
              required
            />
            <input
              placeholder="Age"
              type="number"
              value={form.age}
              onChange={(e) => updateField('age', e.target.value)}
            />
            <input
              placeholder="Grade"
              value={form.grade}
              onChange={(e) => updateField('grade', e.target.value)}
            />
            <input
              placeholder="T-shirt size"
              value={form.tshirt_size}
              onChange={(e) => updateField('tshirt_size', e.target.value)}
            />
            <textarea
              placeholder="Allergies"
              value={form.allergies}
              onChange={(e) => updateField('allergies', e.target.value)}
              rows={2}
            />
            <textarea
              placeholder="Medical notes"
              value={form.medical_notes}
              onChange={(e) => updateField('medical_notes', e.target.value)}
              rows={2}
            />

            <h3 style={{ marginBottom: 0, marginTop: 12 }}>Primary Guardian</h3>
            <input
              placeholder="Guardian first name"
              value={form.guardian_first_name}
              onChange={(e) => updateField('guardian_first_name', e.target.value)}
              required
            />
            <input
              placeholder="Guardian last name"
              value={form.guardian_last_name}
              onChange={(e) => updateField('guardian_last_name', e.target.value)}
              required
            />
            <input
              placeholder="Relationship"
              value={form.guardian_relationship}
              onChange={(e) => updateField('guardian_relationship', e.target.value)}
            />
            <input
              placeholder="Guardian email"
              type="email"
              value={form.guardian_email}
              onChange={(e) => updateField('guardian_email', e.target.value)}
              required
            />
            <input
              placeholder="Guardian phone"
              value={form.guardian_phone}
              onChange={(e) => updateField('guardian_phone', e.target.value)}
            />

            <h3 style={{ marginBottom: 0, marginTop: 12 }}>Emergency Contact</h3>
            <input
              placeholder="Emergency contact name"
              value={form.emergency_name}
              onChange={(e) => updateField('emergency_name', e.target.value)}
            />
            <input
              placeholder="Emergency relationship"
              value={form.emergency_relationship}
              onChange={(e) => updateField('emergency_relationship', e.target.value)}
            />
            <input
              placeholder="Emergency phone (required if adding Contact)"
              value={form.emergency_phone}
              onChange={(e) => updateField('emergency_phone', e.target.value)}
            />
            <h3 style={{ marginBottom: 0, marginTop: 12 }}>Registration Details</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={form.liability_waiver}
                onChange={(e) => updateField('liability_waiver', e.target.checked)}
              />
              Liability Waiver Signed
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={form.photo_release}
                onChange={(e) => updateField('photo_release', e.target.checked)}
              />
              Photo Release Signed
            </label>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={saving}>
                {saving
                  ? 'Saving...'
                  : editingRegistrationId
                    ? 'Update Registration'
                    : 'Save Registration'}
              </button>

              {editingRegistrationId && (
                <button
                  type="button"
                  onClick={resetForm}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </div>

        <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>Registrations</h2>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={exportRosterCsv}>
                Export Roster CSV
              </button>
              <button type="button" onClick={exportEmailsCsv}>
                Export Emails CSV
              </button>
              <button type="button" onClick={copyEmailsToClipboard}>
                Copy Emails
              </button>
            </div>
          </div>

          <input
            placeholder="Search camper..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginTop: 10, marginBottom: 10, width: '100%' }}
          />

          {loading ? (
            <p>Loading...</p>
          ) : filteredCampers.length === 0 ? (
            <p>No campers found.</p>
          ) : (
            <table width="100%" cellPadding="8" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th align="left">Camper</th>
                  <th align="left">Age</th>
                  <th align="left">Grade</th>
                  <th align="left">Guardian</th>
                  <th align="left">Email</th>
                  <th align="left">Emergency</th>
                  <th align="left">Check-In</th>
                  <th align="left">Waiver</th>
                  <th align="left">Photo</th>
                  <th align="left">Status</th>
                  <th align="left">Edit</th>
                  <th align="left">Delete</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampers.map((c) => {
                  if (!c.campers) return null

                  const primaryGuardian =
                    c.guardians?.find((g) => g.is_primary) || c.guardians?.[0] || null
                  const emergency = c.emergency_contacts?.[0] || null

                  const statusText = !c.liability_waiver
                    ? `⚠️ Waiver Missing${c.attendance_status === 'checked_in' ? ' • Checked In' : ''}`
                    : c.attendance_status === 'checked_in'
                      ? '✅ Checked In'
                      : 'Registered'

                  return (
                    <tr
                      key={c.id}
                      style={{
                        borderTop: '1px solid #eee',
                        backgroundColor: !c.liability_waiver ? '#fff8e1' : 'white',
                      }}
                    >
                      <td>{c.campers.first_name} {c.campers.last_name}</td>
                      <td>{c.campers.age ?? ''}</td>
                      <td>{c.campers.grade ?? ''}</td>
                      <td>
                        {primaryGuardian
                          ? `${primaryGuardian.first_name} ${primaryGuardian.last_name}`
                          : ''}
                      </td>
                      <td>{primaryGuardian?.email ?? ''}</td>
                      <td>
                        {emergency ? `${emergency.name} (${emergency.phone})` : ''}
                      </td>
                      <td>
                        <button onClick={() => toggleCheckIn(c.id, c.attendance_status)}>
                          {c.attendance_status === 'checked_in' ? '✅ Checked In' : 'Check In'}
                        </button>
                      </td>
                      <td>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="checkbox"
                            checked={!!c.liability_waiver}
                            onChange={() => toggleWaiver(c.id, c.liability_waiver)}
                          />
                          {c.liability_waiver ? 'Signed' : 'Missing'}
                        </label>
                      </td>
                      <td>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="checkbox"
                            checked={!!c.photo_release}
                            onChange={() => togglePhotoRelease(c.id, c.photo_release)}
                          />
                          {c.photo_release ? 'Signed' : 'Missing'}
                        </label>
                      </td>
                      <td>{statusText}</td>
                      <td>
                        <button onClick={() => startEdit(c)}>
                          Edit
                        </button>
                      </td>
                      <td>
                        <button onClick={() => deleteRegistration(c.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)