// Squad Exams Module - EXACT COPY from original squad.js
import { supabase } from '../supabaseClient.js';
import { currentSquad, currentProfile } from './state.js';
import { loadGlobalSettings } from './utils.js';

/**
 * Start shared exam - EXACT COPY
 */
export async function startSharedExam() {
    try {
        // 0. Check if there's already an active challenge
        const { data: activeChallenge } = await supabase
            .from('squad_exam_challenges')
            .select('id')
            .eq('squad_id', currentSquad.id)
            .eq('status', 'active')
            .maybeSingle();

        if (activeChallenge) {
            Swal.fire('تنبيه', 'في تحدي نشط حالياً! لازم ينتهي الأول قبل ما تبدأ تحدي جديد.', 'warning');
            return;
        }

        // 1. Fetch FRESH settings before starting any challenge selection
        await loadGlobalSettings();

        // Use correct field names from profiles table
        const academicYear = currentProfile.academic_year;
        const currentTerm = currentProfile.current_term;
        const department = currentProfile.department;

        if (!academicYear || !currentTerm) {
            Swal.fire('تنبيه', 'يرجى تحديث بياناتك الدراسية من البروفايل أولاً.', 'warning');
            return;
        }

        // 1. Fetch Subjects for this academic year
        const { data: allSubjects, error } = await supabase
            .from('subjects')
            .select('*')
            .eq('is_active', true)
            .eq('academic_year', academicYear)
            .order('order_index');

        if (error) throw error;

        // 2. Filter subjects (same logic as dashboard)
        const mySubjects = allSubjects.filter(s => {
            // Shared Subjects: Same Term & No Department
            const isShared = s.current_term === currentTerm && (!s.department || s.department === '');
            // Department-specific subjects
            const isDept = department && s.department === department && (!s.current_term || s.current_term === currentTerm);

            return isShared || isDept;
        });

        if (mySubjects.length === 0) {
            Swal.fire('تنبيه', 'لا توجد مواد متاحة لسنتم الدراسية حالياً.', 'info');
            return;
        }

        const { value: subjId } = await Swal.fire({
            title: 'اختار المادة 📚',
            input: 'select',
            inputOptions: Object.fromEntries(mySubjects.map(s => [s.id, s.name_ar || s.title])),
            inputPlaceholder: 'اختار المادة...',
            showCancelButton: true,
            confirmButtonText: 'التالي',
            cancelButtonText: 'إلغاء'
        });

        if (!subjId) return;

        // 3. Show transitional popup
        await Swal.fire({
            title: 'لحظة واحدة...',
            text: 'هيتم تحويلك لصفحة المادة عشان تختار الامتحان اللي عاوزه.',
            icon: 'info',
            timer: 2000,
            showConfirmButton: false,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        // 4. Redirect to subject.html in squad mode
        window.location.href = `subject.html?id=${subjId}&mode=squad&squad_id=${currentSquad.id}`;

    } catch (err) {
        console.error(err);
        Swal.fire('خطأ', 'فشل في تحميل المواد الدراسية.', 'error');
    }
}

// Expose for global access
window.startSharedExam = startSharedExam;
