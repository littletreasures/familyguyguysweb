"""
test_review_validation.py — Unit tests for first-person POV host review validation and prompt enforcement.
"""
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))

from pipeline.validators import check_first_person_review, validate_reviews_data


class TestFirstPersonReviewValidation(unittest.TestCase):
    """Tests the POV quality gate for host reviews."""

    def test_valid_first_person_reviews_pass(self):
        """Standard first-person reviews from s02e01 should pass without errors."""
        tyler_review = (
            "This felt like the self-actualized version of Family Guy where they finally "
            "found the rhythm they were missing in the first season. Everything hit rapid-fire "
            "and captured the exact show that I loved growing up. They finally became the boss "
            "bitch they were meant to be, and I had a great time from start to finish."
        )
        self.assertEqual(check_first_person_review("Tyler", tyler_review), [])

        jason_review = (
            "Watching this while sitting upright at a desk like a dignified human being "
            "definitely enhanced my enjoyment of all the gags. The middle chunk of the episode "
            "delivered a solid string of laughs with much better comedic rhythm than season one. "
            "It is a fantastic episode for the gaggers that easily earns a top-tier score."
        )
        self.assertEqual(check_first_person_review("Jason", jason_review), [])

        collin_review = (
            "Peter Peter Caviar Eater proves that the writers have officially manifested their vision "
            "and recognized their self-worth. The pacing and gags fire on all cylinders as the show "
            "hits a whole new stride in season two. If you have made it this far into the podcast "
            "and haven't watched the show yet, this is definitely the episode to start with."
        )
        self.assertEqual(check_first_person_review("Collin", collin_review), [])

    def test_user_example_third_person_review_rejected(self):
        """The user's exact third-person example from s02e03 must be caught and rejected."""
        user_example = (
            "Owning his contrarian take against one of the show's most iconic installments, "
            "Jason felt the non-stop dream-logic gags lacked any real consequences or grounding. "
            "While moments like Randy Newman and Joe fighting mutant rats landed, the over-reliance "
            "on absurd hand-waving and the exhausting chicken fight left him cold. A generous bump "
            "from his initial half-point keeps it from being a total disaster."
        )
        errors = check_first_person_review("Jason", user_example)
        self.assertGreater(len(errors), 0)
        self.assertTrue(any("third person" in e.lower() for e in errors))

    def test_s02e02_third_person_reviews_rejected(self):
        """Verify all three third-person reviews from s02e02 are caught."""
        s02e02_jason = (
            "Jason enjoyed the episode fine, appreciating several of the goofy gags and the "
            "character building that presented Peter as a caring father in juxtaposition to his "
            "own dad. However, he felt the narrative structure leaned too heavily on disconnected "
            "'and then this happens' beats rather than natural cause-and-effect progression."
        )
        errors_j = check_first_person_review("Jason", s02e02_jason)
        self.assertGreater(len(errors_j), 0)

        s02e02_collin = (
            "Collin felt his perception was somewhat tainted by rewatching the episode three or "
            "four times, though he noted that specific gags like the waffle iron joke still made "
            "him laugh. Overall, he did not care for the central plot about Peter's father and "
            "was not sold on seeing Peter Griffin's softer side."
        )
        errors_c = check_first_person_review("Collin", s02e02_collin)
        self.assertGreater(len(errors_c), 0)

        s02e02_tyler = (
            "Tyler related to the severe religious grandparent dynamic and thought Peter's "
            "desperation for his father's approval was an interesting character beat. Even so, "
            "he agreed the story felt disjointed and contained noticeable lulls that dragged "
            "the pacing down compared to the prior episode."
        )
        errors_t = check_first_person_review("Tyler", s02e02_tyler)
        self.assertGreater(len(errors_t), 0)

    def test_s02e99_guest_and_hosts_third_person_rejected(self):
        """Verify s02e99 third-person patterns are caught for both hosts and guest."""
        s02e99_collin = "Collin called his shot early on Peter Griffin in the Super Bowl and loved seeing the show hit its stride."
        self.assertGreater(len(check_first_person_review("Collin", s02e99_collin)), 0)

        s02e99_tim = "Tim had a blast kicking off season two with the crew, thoroughly enjoying the rapid-fire gags."
        self.assertGreater(len(check_first_person_review("Tim", s02e99_tim)), 0)

    def test_pronoun_third_person_opening_rejected(self):
        """Reviews opening with 'He felt...' or 'He enjoyed...' must be rejected."""
        he_review = "He enjoyed the episode fine and laughed at the mutant rat sequence."
        errors = check_first_person_review("Jason", he_review)
        self.assertGreater(len(errors), 0)
        self.assertTrue(any("third-person pronoun" in e.lower() for e in errors))

    def test_cohost_mention_in_first_person_allowed(self):
        """A host referencing another co-host in first-person must pass without errors."""
        review_mentioning_collin = (
            "I loved the cold open, and I completely agreed with Collin that the cutaway "
            "was absolute genius. My personal favorite bit was Peter falling down the stairs."
        )
        # Checking for Jason (the reviewing host)
        errors = check_first_person_review("Jason", review_mentioning_collin)
        self.assertEqual(errors, [])

    def test_pop_culture_external_name_match_allowed(self):
        """A mention of 'Jason Voorhees' in Jason's review should not falsely flag as 3rd person self-reference."""
        review_with_jason_voorhees = (
            "I couldn't stop laughing when Jason Voorhees popped out of the closet. "
            "My gut score was solid from that point onward."
        )
        errors = check_first_person_review("Jason", review_with_jason_voorhees)
        self.assertEqual(errors, [])

    def test_validate_reviews_data_with_first_person_reviews(self):
        """Full validate_reviews_data should succeed when reviews are first-person."""
        payload = {
            "episode_id": "s02e01",
            "reviews": [
                {
                    "host_name": "Jason",
                    "rating": 4.5,
                    "rating_source_note": "four and a half Super Bowls",
                    "rating_scale_max": 5,
                    "review": "I had a great time watching this episode and loved the gags.",
                    "pull_quote": "A dignified viewing."
                },
                {
                    "host_name": "Collin",
                    "rating": 4.5,
                    "rating_source_note": "four and a half Super Bowls",
                    "rating_scale_max": 5,
                    "review": "My favorite episode so far this season. The pacing was electric.",
                    "pull_quote": "Top tier."
                },
                {
                    "host_name": "Tyler",
                    "rating": 4.75,
                    "rating_source_note": "ninety-five bikinied Lois out of one hundred",
                    "rating_scale_max": 100,
                    "review": "I loved every minute of this rapid-fire rhythm.",
                    "pull_quote": "Boss bitch."
                }
            ]
        }
        res = validate_reviews_data(payload)
        self.assertTrue(res["passed"])
        self.assertEqual(res["errors"], [])

    def test_validate_reviews_data_fails_on_third_person_review(self):
        """Full validate_reviews_data must fail when any host review is in third person."""
        payload = {
            "episode_id": "s02e03",
            "reviews": [
                {
                    "host_name": "Jason",
                    "rating": 1.5,
                    "rating_source_note": "one and a half apple bites out of five",
                    "rating_scale_max": 5,
                    "review": "Owning his contrarian take, Jason felt the dream-logic gags lacked consequences.",
                    "pull_quote": "Chicken fight."
                },
                {
                    "host_name": "Collin",
                    "rating": 5.0,
                    "rating_source_note": "five out of five",
                    "rating_scale_max": 5,
                    "review": "I fully embraced the absurd comedy premise.",
                    "pull_quote": "Top marks."
                },
                {
                    "host_name": "Tyler",
                    "rating": 5.0,
                    "rating_source_note": "five out of five",
                    "rating_scale_max": 5,
                    "review": "I thought virtually every single joke hit.",
                    "pull_quote": "Classic."
                }
            ]
        }
        res = validate_reviews_data(payload)
        self.assertFalse(res["passed"])
        self.assertTrue(any("third person" in e.lower() for e in res["errors"]))


class TestSkillAndPipelinePromptDirectives(unittest.TestCase):
    """Verifies that the prompt files contain required first-person instructions."""

    def test_step2_reviews_contains_first_person_directives(self):
        step2_file = Path(__file__).parent / "pipeline" / "step2_reviews.py"
        content = step2_file.read_text(encoding="utf-8")
        self.assertIn("MANDATORY FIRST-PERSON (POV) REQUIREMENT:", content)
        self.assertIn("NEVER use third-person phrasing", content)
        self.assertIn("DO NOT write 'Jason felt...'", content)

    def test_transcript_review_skill_contains_first_person_directives(self):
        skill_file = Path(__file__).parent / "transcript_review_skill.md"
        content = skill_file.read_text(encoding="utf-8")
        self.assertIn("FIRST PERSON ('I', 'me', 'my', 'myself')", content)
        self.assertIn("STRICT PROHIBITION ON THIRD PERSON", content)
        self.assertIn("Never write about the host in the third person", content)


if __name__ == "__main__":
    unittest.main()
