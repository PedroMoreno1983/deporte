"""Pitch geometry: coordinate mapping, distance & angle to goal.

Pure-python — no heavy deps, so these always run.
"""
from __future__ import annotations

import math

from app.analytics.pitch import (
    PITCH_LENGTH_M, PITCH_WIDTH_M, GOAL_WIDTH_M,
    to_meters, distance_to_goal, goal_angle, zone_index, is_valid_xy,
)


def test_to_meters_corners_and_centre():
    assert to_meters(0, 0) == (0.0, 0.0)
    assert to_meters(100, 100) == (PITCH_LENGTH_M, PITCH_WIDTH_M)
    mx, my = to_meters(50, 50)
    assert math.isclose(mx, PITCH_LENGTH_M / 2)
    assert math.isclose(my, PITCH_WIDTH_M / 2)


def test_distance_to_goal_known_points():
    # Dead centre of the goal line -> 0 m.
    assert math.isclose(distance_to_goal(100, 50), 0.0, abs_tol=1e-6)
    # Penalty spot is 11 m out, central.
    pen_x = (PITCH_LENGTH_M - 11.0) / PITCH_LENGTH_M * 100
    assert math.isclose(distance_to_goal(pen_x, 50), 11.0, abs_tol=0.1)
    # Halfway line, central -> half the pitch length.
    assert math.isclose(distance_to_goal(50, 50), PITCH_LENGTH_M / 2, abs_tol=0.1)


def test_goal_angle_central_is_widest():
    # At a fixed distance, the central shot subtends the widest angle.
    central = goal_angle(89.5, 50)
    offset = goal_angle(89.5, 70)
    assert central > offset > 0


def test_goal_angle_closer_is_wider_when_central():
    near = goal_angle(96, 50)
    far = goal_angle(80, 50)
    assert near > far > 0


def test_goal_angle_bounded():
    for x, y in [(0, 0), (50, 50), (100, 50), (99, 99), (100, 0)]:
        a = goal_angle(x, y)
        assert 0.0 <= a <= math.pi


def test_zone_index_clamped():
    assert zone_index(0, 0, cols=6, rows=4) == (0, 0)
    assert zone_index(100, 100, cols=6, rows=4) == (5, 3)
    assert zone_index(50, 50, cols=6, rows=4) == (3, 2)


def test_is_valid_xy():
    assert is_valid_xy(0, 0) and is_valid_xy(100, 100) and is_valid_xy(50, 50)
    assert not is_valid_xy(None, 50)
    assert not is_valid_xy(50, None)
    assert not is_valid_xy(-1, 50)
    assert not is_valid_xy(50, 101)
