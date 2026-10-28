-- Fix missing total_marks on Assignments 6, 7, 8 in Division 4
-- Course: CORE (High Performance Computing Lab, Division 4, Semester 7)
-- Course ID: 43d5f6d7-1621-4ced-8ec6-206bdb2cb3a9
--
-- These assignments were created with total_marks = NULL, which caused them
-- to be excluded from the faculty Gradebook (MarksTab query) and prevented
-- automatic grade calculation for 151 submitted student works.

UPDATE assignments
SET total_marks = 10,
    updated_at = NOW()
WHERE id IN (
  'd9fd303f-00da-403a-8216-e19d6263b980', -- 6.Openmp_Program4
  'feba38c9-a8f9-4633-a870-55ff44912c06', -- 7.OpenMP_Program 5
  '58aea76c-7812-4fdf-9897-6449ea19ba94'  -- 8.OpenMp_Program6
);
