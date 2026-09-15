import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location("sign_beta", pathlib.Path(__file__).parents[1] / "scripts/sign_beta.py")
sign_beta = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sign_beta)


class UpdateValidation(unittest.TestCase):
    identity = {"applicationId": "com.menteagil.offline.beta", "firstVersionCode": 8}
    base = {"applicationId": "com.menteagil.offline.beta", "versionCode": 8, "debuggable": False}

    def test_first_install_and_forward_update(self):
        sign_beta.validate_release(self.base, self.identity)
        sign_beta.validate_release({**self.base, "versionCode": 9}, self.identity, self.base)

    def test_update_requires_previous_delivered_apk(self):
        with self.assertRaisesRegex(ValueError, "previous-apk"):
            sign_beta.validate_release({**self.base, "versionCode": 9}, self.identity)

    def test_downgrade_and_same_version_are_rejected(self):
        for version in (7, 8):
            with self.subTest(version=version), self.assertRaises(ValueError):
                sign_beta.validate_release({**self.base, "versionCode": version}, self.identity, self.base)

    def test_other_packages_and_debug_variants_are_rejected(self):
        for candidate in ({**self.base, "applicationId": "com.menteagil.offline.preview4"},
                          {**self.base, "debuggable": True}):
            with self.subTest(candidate=candidate), self.assertRaises(ValueError):
                sign_beta.validate_release(candidate, self.identity)

    def test_previous_apk_must_be_from_permanent_beta(self):
        with self.assertRaises(ValueError):
            sign_beta.validate_release({**self.base, "versionCode": 9}, self.identity,
                                       {**self.base, "applicationId": "com.example.other"})


if __name__ == "__main__":
    unittest.main()
