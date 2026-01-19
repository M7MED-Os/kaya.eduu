-- Function to clean up student data when their academic profile changes
-- It deletes exam results for subjects that no longer match the student's new Grade, Term, or Stream.

CREATE OR REPLACE FUNCTION cleanup_student_data(p_user_id UUID, p_grade TEXT, p_term TEXT, p_stream TEXT)
RETURNS void AS $$
BEGIN
    DELETE FROM results
    WHERE user_id = p_user_id
    AND exam_id IN (
        SELECT exams.id FROM exams
        JOIN subjects ON exams.subject_id = subjects.id
        WHERE NOT (
            -- Keep if Grade Matches...
            subjects.grade = p_grade
            AND (
                -- AND Term Matches (for G1/2)
                (p_grade IN ('1', '2') AND subjects.term = p_term)
                OR
                -- OR Stream Matches (for G3) OR is a Common Subject
                (p_grade = '3' AND (
                    subjects.stream = p_stream 
                    OR subjects.stream IN ('languages', 'scientific_common', 'non_scoring')
                ))
            )
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
