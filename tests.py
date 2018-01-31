import unittest

from channelman import calculate_chans


class TestChannelCalc(unittest.TestCase):

    def test_simple_calc(self):
        chans = [255] * 48
        output_chans = [None] * 48
        self.assertEqual(calculate_chans(chans, output_chans, [], 50), [127]*48)


if __name__ == '__main__':
    unittest.main()
