#!/usr/bin/python3
"""
This script calculates the largest possible integer k such that
if ONE is set to 10 ** k, it can be mathematically proven that
the largest computation in the DoubleDiceToken contract
would never exceed type(uint256).max
"""

from math import ceil, exp, floor
from math import log as ln
from math import log2, log10

MILLION_TOKENS = 10**6 * 10**18
BILLION_TOKENS = 10**9 * 10**18


def ln_f_upper_bound(T_over_C, max_epsilon):
    """max(f) depends not on the absolute values of T and C, but only on their ratio"""
    return (T_over_C - 1) / (1 - max_epsilon)


def max_possible_log10_ONE(max_T, min_C_over_T, max_epsilon):
    """Return the largest log10(ONE) such that max(f) * ONE * max(T) ≤ type(uint256).max"""
    max_T_over_C = 1 / min_C_over_T
    max_ln_f_upper_bound = ln_f_upper_bound(max_T_over_C, max_epsilon)
    return log10(2**256 - 1) - (max_ln_f_upper_bound / ln(10) + log10(max_T))


def f_upper_bound(T_over_C, max_epsilon):
    """max(f) depends not on the absolute values of T and C, but only on their ratio"""
    return exp((T_over_C - 1) / (1 - max_epsilon))


def max_possible_ONE(max_T, min_C_over_T, max_epsilon):
    """Return the largest log10(ONE) such that max(f) * ONE * max(T) ≤ type(uint256).max"""
    max_T_over_C = 1 / min_C_over_T
    max_f_upper_bound = f_upper_bound(max_T_over_C, max_epsilon)
    return (2**256 - 1) / (max_f_upper_bound * max_T), max_f_upper_bound


MAX_T = 20 * BILLION_TOKENS
MAX_EPSILON = 0.5
MIN_C_OVER_T = 0.5

print(f'MAX_T         = {MAX_T / BILLION_TOKENS} billion tokens')
print(f'MIN_C_OVER_T) = {MIN_C_OVER_T}')
print(f'MAX_ε         = {MAX_EPSILON}')

MAX_LOG10_ONE = max_possible_log10_ONE(MAX_T, MIN_C_OVER_T, MAX_EPSILON)
MAX_ONE, max_f_upper_bound = max_possible_ONE(MAX_T, MIN_C_OVER_T, MAX_EPSILON)

print(f'MAX_ONE (more precise)        = {10 ** MAX_LOG10_ONE:0.9g}')
print(f'MAX_ONE (clearer calculation) = {MAX_ONE:0.9g}')

LOG10_ONE = floor(MAX_LOG10_ONE)
ONE = 10 ** LOG10_ONE
print(f'Setting ONE = 10 ** {LOG10_ONE} = {float(ONE)}')

max_possible_computation = ceil(max_f_upper_bound * (ONE * MAX_T))

MAX_UINT256 = 2 ** 256 - 1

assert max_possible_computation < MAX_UINT256

print(f'With ONE = {float(ONE)}:')
print(f'max possible computation')
print(f'  = max(f) * ONE * MAX_T')
print(f'  = {max_f_upper_bound:0.9g} * {float(ONE)} * {float(MAX_T)}')
print(f'  = {max_f_upper_bound:0.9g} * {float(ONE)} * {float(MAX_T)}')
print(f'  = {float(max_possible_computation):0.9g} = 2 ** {log2(max_possible_computation):0.9g}')
print(f'  < {float(MAX_UINT256):0.9g} = 2 ** 256 - 1')
